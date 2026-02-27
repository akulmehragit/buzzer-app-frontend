"use client";

import React, { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { QRCodeCanvas } from "qrcode.react";

const socket: Socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000");


const TEAMS = ["Team Red", "Team Blue", "Team Green", "Team Gold", "Team Purple"];

const teamStyles: Record<string, string> = {
    "Team Red": "bg-[#E64133] text-white border-[#E64133]",
    "Team Blue": "bg-[#56B4E9] text-black border-[#56B4E9]",
    "Team Green": "bg-[#009E73] text-white border-[#009E73]",
    "Team Gold": "bg-[#E69F00] text-black border-[#E69F00]",
    "Team Purple": "bg-[#CC79A7] text-white border-[#CC79A7]",
    "HOST": "bg-slate-700 text-slate-200 border-slate-500",
    "SPECTATOR": "bg-slate-800 text-white border-slate-600"
};

interface BuzzEntry { userId: string; time: number; }
interface Player { id: string; name: string; userId: string; teamId?: string; isOnline: boolean; isAway: boolean; isHost: boolean; }
interface TeamStats { wins: number; }

export default function Home() {
    const [roomId, setRoomId] = useState("");
    const [name, setName] = useState("");
    const [teamId, setTeamId] = useState("");
    const [players, setPlayers] = useState<Player[]>([]);
    const [buzzOrder, setBuzzOrder] = useState<BuzzEntry[]>([]);
    const [teamStats, setTeamStats] = useState<Record<string, TeamStats>>({});
    const [isLocked, setIsLocked] = useState(false);
    const [joined, setJoined] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const [clockOffset, setClockOffset] = useState(0);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [canBuzz, setCanBuzz] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const currentUser = typeof window !== 'undefined' ? localStorage.getItem("buzzer_userId") : null;
    const me = players.find(p => p.userId === currentUser);
    const isHost = me?.isHost;
    const myTeam = me?.teamId;

    const isHostRef = useRef(isHost);
    useEffect(() => { isHostRef.current = isHost; }, [isHost]);

    const joinLink = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?room=${roomId}` : "";

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get("room");
        if (roomParam) setRoomId(roomParam.toUpperCase());

        const syncClock = () => socket.emit("sync_ping", { clientTime: Date.now() });
        socket.on("sync_pong", ({ clientTime, serverTime }) => {
            const rtt = Date.now() - clientTime;
            setClockOffset((serverTime + rtt / 2) - Date.now());
        });

        const handleVisibilityChange = () => {
            if (joined && roomId) {
                const status = document.visibilityState === 'visible' ? 'active' : 'away';
                socket.emit("updateStatus", { roomId, userId: currentUser, status });
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        const interval = setInterval(syncClock, 10000);
        syncClock();

        return () => {
            clearInterval(interval);
            socket.off("sync_pong");
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [joined, roomId, currentUser]);

    useEffect(() => {
        audioRef.current = new Audio("/buzz.mp3");
        socket.on("buzzOrder", (order) => {
            setBuzzOrder(order);
            if (order.length === 1 && audioRef.current && isHostRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(() => { });
            }
        });
        socket.on("lockStatus", (status) => setIsLocked(status));
        socket.on("roomCreated", (id: string) => { setRoomId(id); setJoined(true); setIsCreating(false); });
        socket.on("playerList", (list: Player[]) => setPlayers(list));
        socket.on("statsUpdate", (stats) => setTeamStats(stats));
        socket.on("countdownUpdate", (val) => setCountdown(val === 0 ? null : val));
        socket.on("buzzersEnabled", (status) => setCanBuzz(status));
        socket.on("error", (msg) => { alert(msg); setJoined(false); });
        return () => { socket.removeAllListeners(); };
    }, []);

    const handleJoinRoom = () => {
        if (!name || !roomId || !teamId) return;
        localStorage.setItem("buzzer_name", name);
        localStorage.setItem("buzzer_roomId", roomId);
        socket.emit("joinRoom", { roomId, name, userId: currentUser, teamId });
        setJoined(true);
    };

    const handleBuzz = () => {
        if (!canBuzz || isLocked || countdown !== null) return;
        socket.emit("buzz", { roomId, userId: currentUser, timestamp: Date.now() + clockOffset });
    };

    const handleCreateRoom = () => {
        if (!name) return;
        setIsCreating(true);
        localStorage.setItem("buzzer_name", name);
        socket.emit("createRoom", { name, userId: currentUser, teamId: "HOST" });
    };

    const handleExit = () => {
        socket.emit("leaveRoom", { roomId, userId: currentUser });
        localStorage.removeItem("buzzer_name");
        localStorage.removeItem("buzzer_roomId");
        setJoined(false);
        setRoomId("");
        setTeamId("");
    };

    useEffect(() => {
        const savedName = localStorage.getItem("buzzer_name");
        const savedRoom = localStorage.getItem("buzzer_roomId");
        const savedId = localStorage.getItem("buzzer_userId") || Math.random().toString(36).substring(7);
        localStorage.setItem("buzzer_userId", savedId);

        if (savedName && savedRoom) {
            setName(savedName);
            setRoomId(savedRoom);
            socket.emit("rejoinRoom", { roomId: savedRoom, name: savedName, userId: savedId });
            setJoined(true);
        }
    }, []);

    const teamHasBuzzed = !!(myTeam && myTeam !== "HOST" && buzzOrder.some(b => players.find(pl => pl.userId === b.userId)?.teamId === myTeam));

    return (
        <div className="relative w-full h-screen overflow-hidden bg-slate-950 flex items-center justify-center">
            <div className="absolute inset-0 z-0 opacity-40" style={{ backgroundImage: "url(/background.jpg)", backgroundSize: 'cover' }} />


            <div className="relative z-20 w-full max-w-md px-6">
                {!joined ? (
                    <div className="bg-white/10 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/20 shadow-2xl flex flex-col gap-6">
                        <h1 className="text-4xl font-black text-center text-orange-400 uppercase leading-tight">Kick It With Kuv</h1>
                        <div className="space-y-4">
                            <input className="w-full bg-white/10 border border-white/10 p-4 rounded-2xl text-white outline-none placeholder:text-white/30" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} />
                            {roomId.length > 0 && (
                                <div className="relative w-full">
                                    <select className="w-full bg-white/10 border border-white/10 p-4 rounded-2xl text-white outline-none appearance-none" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                                        <option value="" disabled className="bg-slate-900">Select a Team</option>
                                        {TEAMS.map(t => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/40">
                                        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                    </div>
                                </div>
                            )}
                            <input className="w-full bg-white/10 border border-white/10 p-4 rounded-2xl text-white outline-none placeholder:text-white/30" placeholder="Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} />
                        </div>
                        <div className="flex flex-col gap-3">
                            <button disabled={!name || !roomId || !teamId} className="w-full bg-red-600 font-bold py-4 rounded-2xl text-white active:scale-95 disabled:opacity-30 disabled:grayscale" onClick={handleJoinRoom}>Join Room</button>
                            <button disabled={!name || roomId.length > 0} className="w-full bg-white/10 font-bold py-4 rounded-2xl text-white active:scale-95 disabled:hidden" onClick={handleCreateRoom}>{isCreating ? "Creating..." : "Create New Room"}</button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-black/60 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white/20 shadow-2xl flex flex-col gap-4 text-white text-center w-full max-w-md h-[88vh]">

                        <div className="flex gap-2 items-center">
                            <button onClick={handleExit} className="bg-white/10 py-3 px-6 rounded-xl text-[10px] font-bold uppercase active:scale-95">Exit</button>

                            {!isHost ? (
                                <div className="flex-1 bg-white/5 py-2 px-4 rounded-xl flex justify-between items-center border border-white/5">
                                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Room</span>
                                    <span className="text-sm font-mono font-black">{roomId}</span>
                                </div>
                            ) : (
                                <button onClick={() => socket.emit("startQuestion", { roomId, userId: currentUser })} className="flex-1 bg-blue-600/30 text-blue-400 py-3 rounded-xl text-[10px] font-bold uppercase border border-blue-500/50 active:scale-95 animate-pulse">
                                    Start Next Question
                                </button>
                            )}
                        </div>

                        {isHost && (
                            <>
                                <div className="grid grid-cols-5 gap-1 bg-white/5 p-2 rounded-xl border border-white/10">
                                    {TEAMS.map(t => (
                                        <div key={t} className={`flex flex-col items-center p-1 rounded-lg ${teamStyles[t]} opacity-80`}><span className="text-[8px] font-bold uppercase">{t.split(' ')[1]}</span><span className="text-sm font-black">{teamStats[t]?.wins || 0}</span></div>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl">
                                    <div className="text-left">
                                        <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Room Code</span>
                                        <h2 className="text-4xl font-mono font-black tracking-widest leading-none">{roomId}</h2>
                                    </div>
                                    <div className="p-1 bg-white rounded-lg">
                                        <QRCodeCanvas value={joinLink} size={64} />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="min-h-[40px] flex items-center justify-center">
                            {countdown !== null ? (
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] uppercase font-bold text-blue-400 animate-pulse">Reading...</span>
                                    <h3 className={`${isHost ? 'text-5xl' : 'text-3xl'} font-black text-white italic`}>{countdown}</h3>
                                </div>
                            ) : buzzOrder.length > 0 ? (
                                <h3 className="text-2xl font-black text-red-500 italic uppercase italic">Buzzed!</h3>
                            ) : isLocked ? (
                                <h3 className="text-xl font-bold text-orange-400 uppercase tracking-widest animate-pulse italic">Locked</h3>
                            ) : canBuzz ? (
                                <h3 className="text-xl font-bold text-green-500 uppercase tracking-widest animate-bounce italic">Go!</h3>
                            ) : (
                                <h3 className="text-[10px] text-white/40 uppercase font-bold italic tracking-tighter">Waiting for host...</h3>
                            )}
                        </div>

                        <div className="bg-white/5 rounded-2xl p-3 text-left">
                            <h3 className="text-[8px] font-bold uppercase text-white/20 mb-2 tracking-widest">Live Players</h3>
                            <div className="flex flex-wrap gap-1.5 max-h-[60px] overflow-y-auto scrollbar-none">
                                {players.map((p) => {
                                    const isInactive = !p.isOnline || p.isAway;
                                    return (
                                        <span key={p.userId} className={`px-2 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1.5 ${p.teamId ? teamStyles[p.teamId] : "bg-white/10"} ${isInactive ? "opacity-30 grayscale" : ""}`}>
                                            <div className={`w-1 h-1 rounded-full ${isInactive ? "bg-gray-400" : "bg-white animate-pulse"}`} />
                                            {p.name} {p.isHost && "(Host)"}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        {/* PLAYER VIEW: SMALLER, SCROLLABLE QUEUE */}
                        <div className={`bg-white/5 rounded-2xl text-left flex flex-col overflow-hidden ${!isHost ? 'h-[15vh] p-2' : 'flex-1 p-3'}`}>
                            <h3 className="text-[8px] font-bold uppercase text-white/20 mb-1 tracking-widest">Queue</h3>
                            <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                                {buzzOrder.map((buzz, index) => {
                                    const p = players.find(pl => pl.userId === buzz.userId);
                                    const gap = index > 0 ? buzz.time - buzzOrder[0].time : 0;
                                    const isWinner = index === 0;
                                    return (
                                        <div key={buzz.userId} className={`flex justify-between items-center rounded-lg border transition-all ${!isHost ? 'p-1.5' : 'p-2'} ${isWinner ? 'border-red-500 ring-1 ring-red-500/20' : 'border-white/5'} ${p?.teamId ? teamStyles[p.teamId] : ""}`}>
                                            <div className="flex flex-col">
                                                <span className={`${!isHost ? 'text-xs font-bold' : 'text-sm font-black'} truncate max-w-[120px]`}>{p?.name || "User"}</span>
                                                {isHost && <span className="text-[7px] uppercase font-black opacity-60">{p?.teamId}</span>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {index > 0 && <span className="text-[8px] font-mono font-bold opacity-60">+{gap}ms</span>}
                                                <span className={`${!isHost ? 'text-sm' : 'text-base'} font-black`}>#{index + 1}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* PLAYER VIEW: MASSIVE BUZZER BUTTON */}
                        {!isHost ? (
                            <div className="flex-1 flex items-center justify-center">
                                <button
                                    onClick={handleBuzz}
                                    disabled={!canBuzz || isLocked || teamHasBuzzed || countdown !== null}
                                    className={`w-[35vh] h-[35vh] max-w-[280px] max-h-[280px] rounded-full text-5xl font-black italic transition-all shadow-2xl flex items-center justify-center border-white/10 border
                                        ${(!canBuzz || isLocked || teamHasBuzzed || countdown !== null) ? "bg-gray-800 border-b-0 cursor-not-allowed opacity-40 grayscale" : "bg-red-600 border-b-[12px] border-red-800 active:translate-y-2 active:border-b-0"}
                                    `}
                                >
                                    {countdown !== null ? countdown : teamHasBuzzed ? "IN" : !canBuzz ? "WAIT" : "BUZZ!"}
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-2 w-full">
                                <button onClick={() => socket.emit("toggleLock", { roomId, userId: currentUser })} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${isLocked ? "bg-green-600/20 text-green-400 border-green-500" : "bg-orange-600/20 text-orange-400 border-orange-500"}`}>
                                    {isLocked ? "Unlock" : "Lock"}
                                </button>
                                <button onClick={() => socket.emit("reset", { roomId, userId: currentUser })} className="flex-1 bg-red-600/20 text-red-400 py-3 rounded-xl text-[10px] font-black uppercase border border-red-500">
                                    Reset
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}