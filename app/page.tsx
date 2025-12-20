"use client";

import React, { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

const socket: Socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000");

const DVD_SIZE = 180;
const LOGO_IMAGES = ["/1.jpeg", "/2.png", "/3.jpeg"];

interface BuzzEntry {
    userId: string;
    time: number;
}

interface Player {
    id: string;
    name: string;
    userId: string;
    isOnline: boolean;
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
    const [players, setPlayers] = useState<Player[]>([]);
    const [buzzOrder, setBuzzOrder] = useState<BuzzEntry[]>([]);
    const [isLocked, setIsLocked] = useState(false);
    const [joined, setJoined] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [logos, setLogos] = useState<LogoState[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const currentUser = typeof window !== 'undefined' ? localStorage.getItem("buzzer_userId") : null;
    const isHost = players.find(p => p.userId === currentUser)?.isHost;

    useEffect(() => {
        audioRef.current = new Audio("/buzz.mp3");
        const handleSound = (order: BuzzEntry[]) => {
            if (order.length === 1 && audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.log("Audio blocked", e));
            }
        };
        socket.on("buzzOrder", handleSound);
        socket.on("lockStatus", (status) => setIsLocked(status));
        return () => {
            socket.off("buzzOrder", handleSound);
            socket.off("lockStatus");
        };
    }, []);

    useEffect(() => {
        const initialLogos = LOGO_IMAGES.map((src) => ({
            src,
            x: Math.random() * (typeof window !== "undefined" ? window.innerWidth - DVD_SIZE : 200),
            y: Math.random() * (typeof window !== "undefined" ? window.innerHeight - DVD_SIZE : 200),
            vx: (Math.random() > 0.5 ? 2 : -2),
            vy: (Math.random() > 0.5 ? 2 : -2),
        }));
        setLogos(initialLogos);
    }, []);

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

    useEffect(() => {
        socket.on("roomCreated", (id: string) => {
            setRoomId(id);
            setJoined(true);
            setIsCreating(false);
        });
        socket.on("playerList", (list: Player[]) => setPlayers(list));
        socket.on("buzzOrder", (order) => setBuzzOrder(order));
        socket.on("error", (msg) => { alert(msg); setJoined(false); });

        return () => {
            socket.off("roomCreated");
            socket.off("playerList");
            socket.off("buzzOrder");
            socket.off("error");
        };
    }, []);

    const handleJoinRoom = () => {
        if (!name || !roomId) return;
        const userId = localStorage.getItem("buzzer_userId");
        localStorage.setItem("buzzer_name", name);
        localStorage.setItem("buzzer_roomId", roomId);
        socket.emit("joinRoom", { roomId, name, userId });
        setJoined(true);
    };

    const handleBuzz = () => {
        const userId = localStorage.getItem("buzzer_userId");
        socket.emit("buzz", { roomId, userId });
    };

    const handleCreateRoom = () => {
        if (!name) return;
        setIsCreating(true);
        const userId = localStorage.getItem("buzzer_userId");
        localStorage.setItem("buzzer_name", name);
        socket.emit("createRoom", { name, userId });
    };

    const handleExit = () => {
        const userId = localStorage.getItem("buzzer_userId");
        socket.emit("leaveRoom", { roomId, userId });
        localStorage.removeItem("buzzer_name");
        localStorage.removeItem("buzzer_roomId");
        setJoined(false);
        setRoomId("");
    };

    return (
        <div className="relative w-full h-screen overflow-hidden bg-slate-950 flex items-center justify-center">
            <div className="absolute inset-0 z-0 opacity-40" style={{ backgroundImage: "url(/background.jpg)", backgroundSize: 'cover' }} />

            {logos.map((logo, index) => (
                <div key={index} className="absolute z-10 pointer-events-none opacity-30" style={{ left: logo.x, top: logo.y, width: DVD_SIZE, height: DVD_SIZE, backgroundImage: `url(${logo.src})`, backgroundSize: "contain", backgroundRepeat: "no-repeat" }} />
            ))}

            <div className="relative z-20 w-full max-w-md px-6">
                {!joined ? (
                    <div className="bg-white/10 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/20 shadow-2xl flex flex-col gap-6">
                        <h1 className="text-4xl font-black text-center text-orange-400 uppercase">Ready... Go!</h1>
                        <div className="space-y-4">
                            <input className="w-full bg-white/10 border border-white/10 p-4 rounded-2xl text-white outline-none" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
                            <input className="w-full bg-white/10 border border-white/10 p-4 rounded-2xl text-white outline-none" placeholder="Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-3">
                            <button disabled={!name || !roomId} className="w-full bg-red-600 font-bold py-4 rounded-2xl text-white" onClick={handleJoinRoom}>Join Room</button>
                            <button disabled={!name || roomId.length > 0} className="w-full bg-white/10 font-bold py-4 rounded-2xl text-white" onClick={handleCreateRoom}>Create New Room</button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-black/60 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white/20 shadow-2xl flex flex-col gap-4 text-white text-center w-full max-w-md h-[88vh]">
                        {/* HOST DASHBOARD CONTROLS */}
                        <div className="flex gap-2">
                            <button onClick={handleExit} className="flex-1 bg-white/10 py-3 rounded-xl text-[10px] font-bold uppercase">Exit</button>
                            {isHost && (
                                <>
                                    <button onClick={() => socket.emit("toggleLock", { roomId, userId: currentUser })} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase ${isLocked ? "bg-green-600/20 text-green-400 border border-green-500/50" : "bg-orange-600/20 text-orange-400 border border-orange-500/50"}`}>
                                        {isLocked ? "Unlock" : "Lock"}
                                    </button>
                                    <button onClick={() => socket.emit("reset", { roomId, userId: currentUser })} className="flex-1 bg-red-600/20 text-red-400 py-3 rounded-xl text-[10px] font-bold uppercase border border-red-500/50">Reset</button>
                                </>
                            )}
                        </div>

                        <div>
                            <span className="text-[10px] font-black text-red-500 uppercase">Room Code</span>
                            <h2 className="text-4xl font-mono font-black">{roomId}</h2>
                            {isLocked && <p className="text-orange-400 text-[10px] font-bold uppercase mt-1 animate-pulse">Buzzer is Locked</p>}
                        </div>

                        {/* PLAYERS LIST WITH HOST TAG */}
                        <div className="bg-white/5 rounded-2xl p-4 text-left">
                            <h3 className="text-xs font-bold uppercase text-white/40 mb-3">Players</h3>
                            <div className="flex flex-wrap gap-2 max-h-[80px] overflow-y-auto">
                                {players.map((p) => (
                                    <span key={p.userId} className={`px-3 py-1 rounded-full text-[10px] font-semibold flex items-center gap-2 ${p.isOnline ? "bg-white/10" : "opacity-30"}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${p.isOnline ? "bg-green-500" : "bg-gray-600"}`} />
                                        {p.name}
                                        {p.isHost && <span className="text-[8px] bg-orange-500/20 text-orange-400 px-1.5 rounded border border-orange-500/50 uppercase ml-1">Host</span>}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* BUZZ ORDER */}
                        <div className="bg-white/5 rounded-2xl p-4 text-left flex-1 overflow-hidden flex flex-col">
                            <h3 className="text-xs font-bold uppercase text-white/40 mb-3">Buzz Order</h3>
                            <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                                {buzzOrder.map((buzz, index) => (
                                    <div key={buzz.userId} className={`flex justify-between items-center p-3 rounded-xl border ${index === 0 ? 'bg-red-600/20 border-red-500' : 'bg-white/5 border-white/10'}`}>
                                        <span className="font-bold text-sm truncate max-w-[150px]">{players.find(p => p.userId === buzz.userId)?.name || "User"}</span>
                                        <span className={`text-xs font-black px-2 py-1 rounded ${index === 0 ? 'bg-red-500' : 'bg-white/10'}`}>#{index + 1}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* BUZZER BUTTON */}
                        <button
                            onClick={handleBuzz}
                            disabled={isLocked || buzzOrder.some(b => b.userId === currentUser)}
                            className={`w-[25vh] h-[25vh] max-w-[150px] max-h-[150px] mx-auto rounded-full text-3xl font-black italic transition-all shadow-2xl flex items-center justify-center
                                ${isLocked ? "bg-gray-700 border-b-0 cursor-not-allowed opacity-50 grayscale" : "bg-red-600 border-b-[8px] border-red-800 active:translate-y-2 active:border-b-0"}
                            `}
                        >
                            {isLocked ? "LOCKED" : "BUZZ!"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}