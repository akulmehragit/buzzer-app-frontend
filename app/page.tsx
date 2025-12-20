"use client";

import React, { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

const socket: Socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000");

const DVD_SIZE = 180;
const LOGO_IMAGES = ["/1.jpeg", "/2.png", "/3.jpeg"];

const TEAMS = ["Team Red", "Team Blue", "Team Green", "Team Gold", "Team Purple"];

const teamStyles: Record<string, string> = {
    "Team Red": "bg-[#E64133] text-white border-[#E64133]",
    "Team Blue": "bg-[#56B4E9] text-black border-[#56B4E9]",
    "Team Green": "bg-[#009E73] text-white border-[#009E73]",
    "Team Gold": "bg-[#E69F00] text-black border-[#E69F00]",
    "Team Purple": "bg-[#CC79A7] text-white border-[#CC79A7]",
    "HOST": "bg-slate-700 text-slate-200 border-slate-500"
};

interface BuzzEntry {
    userId: string;
    time: number; 
}

interface Player {
    id: string;
    name: string;
    userId: string;
    teamId?: string;
    isOnline: boolean;
    isAway: boolean; // Added for status grouping
    isHost: boolean;
}

interface LogoState {
    src: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
}

export default function Home() {
    const [roomId, setRoomId] = useState("");
    const [name, setName] = useState("");
    const [teamId, setTeamId] = useState("");
    const [players, setPlayers] = useState<Player[]>([]);
    const [buzzOrder, setBuzzOrder] = useState<BuzzEntry[]>([]);
    const [isLocked, setIsLocked] = useState(false);
    const [joined, setJoined] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [logos, setLogos] = useState<LogoState[]>([]);
    const [clockOffset, setClockOffset] = useState(0); 
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const currentUser = typeof window !== 'undefined' ? localStorage.getItem("buzzer_userId") : null;
    const me = players.find(p => p.userId === currentUser);
    const isHost = me?.isHost;
    const myTeam = me?.teamId;

    // --- 1. CLOCK SYNC & VISIBILITY LOGIC ---
    useEffect(() => {
        const syncClock = () => {
            const start = Date.now();
            socket.emit("sync_ping", { clientTime: start });
        };
        socket.on("sync_pong", ({ clientTime, serverTime }) => {
            const now = Date.now();
            const rtt = now - clientTime; 
            setClockOffset((serverTime + rtt / 2) - now);
        });

        // Detect swipe up / backgrounding
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
            if (order.length === 1 && audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(() => {});
            }
        });
        socket.on("lockStatus", (status) => setIsLocked(status));
        socket.on("roomCreated", (id: string) => { setRoomId(id); setJoined(true); setIsCreating(false); });
        socket.on("playerList", (list: Player[]) => setPlayers(list));
        socket.on("error", (msg) => { alert(msg); setJoined(false); });
        return () => { socket.removeAllListeners(); };
    }, []);

    const handleJoinRoom = () => {
        if (!name || !roomId || !teamId) return;
        const userId = localStorage.getItem("buzzer_userId");
        localStorage.setItem("buzzer_name", name);
        localStorage.setItem("buzzer_roomId", roomId);
        socket.emit("joinRoom", { roomId, name, userId, teamId });
        setJoined(true);
    };

    const handleBuzz = () => {
        const userId = localStorage.getItem("buzzer_userId");
        socket.emit("buzz", { roomId, userId, timestamp: Date.now() + clockOffset });
    };

    const handleCreateRoom = () => {
        if (!name) return;
        setIsCreating(true);
        const userId = localStorage.getItem("buzzer_userId");
        localStorage.setItem("buzzer_name", name);
        socket.emit("createRoom", { name, userId, teamId: "HOST" });
    };

    const handleExit = () => {
        const userId = localStorage.getItem("buzzer_userId");
        socket.emit("leaveRoom", { roomId, userId });
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

        const initialLogos = LOGO_IMAGES.map((src) => ({
            src,
            x: Math.random() * (window.innerWidth - DVD_SIZE),
            y: Math.random() * (window.innerHeight - DVD_SIZE),
            vx: (Math.random() > 0.5 ? 2 : -2),
            vy: (Math.random() > 0.5 ? 2 : -2),
        }));
        setLogos(initialLogos);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setLogos((prevLogos) =>
                prevLogos.map((logo) => {
                    const width = window.innerWidth - DVD_SIZE;
                    const height = window.innerHeight - DVD_SIZE;
                    let newX = logo.x + logo.vx;
                    let newY = logo.y + logo.vy;
                    let newVx = logo.vx;
                    let newVy = logo.vy;
                    if (newX <= 0 || newX >= width) newVx = -newVx;
                    if (newY <= 0 || newY >= height) newVy = -newVy;
                    return { ...logo, x: newX, y: newY, vx: newVx, vy: newVy };
                })
            );
        }, 16);
        return () => clearInterval(interval);
    }, []);

    const teamHasBuzzed = !!(myTeam && myTeam !== "HOST" && buzzOrder.some(b => players.find(pl => pl.userId === b.userId)?.teamId === myTeam));

    return (
        <div className="relative w-full h-screen overflow-hidden bg-slate-950 flex items-center justify-center">
            <div className="absolute inset-0 z-0 opacity-40" style={{ backgroundImage: "url(/background.jpg)", backgroundSize: 'cover' }} />

            {logos.map((logo, index) => (
                <div key={index} className="absolute z-10 pointer-events-none opacity-30" style={{ left: logo.x, top: logo.y, width: DVD_SIZE, height: DVD_SIZE, backgroundImage: `url(${logo.src})`, backgroundSize: "contain", backgroundRepeat: "no-repeat" }} />
            ))}

            <div className="relative z-20 w-full max-w-md px-6">
                {!joined ? (
                    <div className="bg-white/10 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/20 shadow-2xl flex flex-col gap-6">
                        <h1 className="text-4xl font-black text-center text-orange-400 uppercase leading-tight">Ready... Vardhinedi Go!</h1>
                        <div className="space-y-4">
                            <input 
                                className="w-full bg-white/10 border border-white/10 p-4 rounded-2xl text-white outline-none placeholder:text-white/30" 
                                placeholder="Your Name" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)} 
                            />
                            
                            {roomId.length > 0 && (
                                <div className="relative w-full">
                                    <select 
                                        className="w-full bg-white/10 border border-white/10 p-4 rounded-2xl text-white outline-none appearance-none" 
                                        value={teamId} 
                                        onChange={(e) => setTeamId(e.target.value)}
                                    >
                                        <option value="" disabled className="bg-slate-900">Select a Team</option>
                                        {TEAMS.map(t => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/40">
                                        <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                                        </svg>
                                    </div>
                                </div>
                            )}

                            <input 
                                className="w-full bg-white/10 border border-white/10 p-4 rounded-2xl text-white outline-none placeholder:text-white/30" 
                                placeholder="Room ID" 
                                value={roomId} 
                                onChange={(e) => setRoomId(e.target.value)} 
                            />
                        </div>
                        <div className="flex flex-col gap-3">
                            <button 
                                disabled={!name || !roomId || !teamId} 
                                className="w-full bg-red-600 font-bold py-4 rounded-2xl text-white transition-all active:scale-95 disabled:opacity-30 disabled:grayscale" 
                                onClick={handleJoinRoom}
                            >
                                Join Room
                            </button>
                            <button 
                                disabled={!name || roomId.length > 0} 
                                className="w-full bg-white/10 font-bold py-4 rounded-2xl text-white transition-all active:scale-95 disabled:hidden" 
                                onClick={handleCreateRoom}
                            >
                                {isCreating ? "Creating..." : "Create New Room"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-black/60 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white/20 shadow-2xl flex flex-col gap-4 text-white text-center w-full max-w-md h-[88vh]">
                        <div className="flex gap-2">
                            <button onClick={handleExit} className="flex-1 bg-white/10 py-3 rounded-xl text-[10px] font-bold uppercase active:scale-95">Exit</button>
                            {isHost && (
                                <>
                                    <button onClick={() => socket.emit("toggleLock", { roomId, userId: currentUser })} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase border transition-all active:scale-95 ${isLocked ? "bg-green-600/20 text-green-400 border-green-500/50" : "bg-orange-600/20 text-orange-400 border-orange-500/50"}`}>
                                        {isLocked ? "Unlock" : "Lock"}
                                    </button>
                                    <button onClick={() => socket.emit("reset", { roomId, userId: currentUser })} className="flex-1 bg-red-600/20 text-red-400 py-3 rounded-xl text-[10px] font-bold uppercase border border-red-500/50 active:scale-95">Reset</button>
                                </>
                            )}
                        </div>

                        <div>
                            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Room Code</span>
                            <h2 className="text-4xl font-mono font-black tracking-widest">{roomId}</h2>
                            {isLocked && <p className="text-orange-400 text-[10px] font-bold uppercase mt-1 animate-pulse tracking-widest">Buzzer Locked</p>}
                        </div>

                        <div className="bg-white/5 rounded-2xl p-4 text-left">
                            <h3 className="text-[10px] font-bold uppercase text-white/40 mb-3 tracking-widest">
                                {myTeam === "HOST" ? "Players (Host View)" : `Players (Your Team: ${myTeam})`}
                            </h3>
                            <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto scrollbar-thin">
                                {players.map((p) => {
                                    // Status Grouping Logic
                                    const isInactive = !p.isOnline || p.isAway;
                                    return (
                                        <span key={p.userId} className={`px-3 py-1 rounded-full text-[10px] font-bold border flex items-center gap-2 
                                            ${p.teamId ? teamStyles[p.teamId] : "bg-white/10 border-white/10"} 
                                            ${isInactive ? "opacity-40 grayscale italic" : ""}`}
                                        >
                                            <div className={`w-1.5 h-1.5 rounded-full ${isInactive ? "bg-gray-400" : "bg-white animate-pulse"}`} />
                                            {p.name}
                                            {p.isAway && p.isOnline && <span className="text-[7px] opacity-70 ml-1 uppercase">(Away)</span>}
                                            {p.isHost && <span className="text-[8px] opacity-70 ml-1">HOST</span>}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-2xl p-4 text-left flex-1 overflow-hidden flex flex-col">
                            <h3 className="text-xs font-bold uppercase text-white/40 mb-3 tracking-widest">Buzz Order</h3>
                            <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                                {buzzOrder.map((buzz, index) => {
                                    const p = players.find(pl => pl.userId === buzz.userId);
                                    const gap = index > 0 ? buzz.time - buzzOrder[0].time : 0;
                                    const isWinner = index === 0;
                                    const tStyle = p?.teamId ? teamStyles[p.teamId] : "";

                                    return (
                                        <div key={buzz.userId} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${isWinner ? 'border-red-500 ring-2 ring-red-500/20' : 'border-white/10'} ${tStyle}`}>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm truncate max-w-[150px]">{p?.name || "User"}</span>
                                                <span className="text-[9px] uppercase font-black opacity-80">{p?.teamId !== "HOST" ? p?.teamId : "Host"}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-xs font-black">#{index + 1}</span>
                                                {index > 0 && <span className="text-[10px] font-mono font-bold">+{gap}ms</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                                {buzzOrder.length === 0 && <p className="text-white/20 italic py-4 text-center text-sm">Waiting for the buzz...</p>}
                            </div>
                        </div>

                        <button
                            onClick={handleBuzz}
                            disabled={isLocked || buzzOrder.some(b => b.userId === currentUser) || teamHasBuzzed}
                            className={`w-[20vh] h-[20vh] max-w-[150px] max-h-[150px] mx-auto rounded-full text-3xl font-black italic transition-all shadow-2xl flex items-center justify-center
                                ${isLocked || teamHasBuzzed ? "bg-gray-700 border-b-0 cursor-not-allowed opacity-50 grayscale" : "bg-red-600 border-b-[8px] border-red-800 active:translate-y-2 active:border-b-0"}
                            `}
                        >
                            {teamHasBuzzed ? "TEAM IN" : isLocked ? "LOCKED" : "BUZZ!"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}