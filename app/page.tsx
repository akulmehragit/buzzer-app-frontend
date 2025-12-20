"use client";

import React, { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const socket: Socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000");

// --- DVD CONFIGURATION ---
const DVD_SIZE = 180;
const LOGO_IMAGES = ["/1.jpeg", "/2.png", "/3.jpeg"];

interface BuzzEntry {
    userId: string;
    time: number;
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
    const [players, setPlayers] = useState<{ id: string, name: string, userId: string }[]>([]);
    const [buzzOrder, setBuzzOrder] = useState<BuzzEntry[]>([]);
    const [joined, setJoined] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Dynamic Multi-Logo State
    const [logos, setLogos] = useState<LogoState[]>([]);

    // Initialize Logos with random positions/directions
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

    // --- MULTI-LOGO ANIMATION LOGIC ---
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
        socket.on("playerList", (list) => setPlayers(list));
        socket.on("buzzOrder", (order) => setBuzzOrder(order));
        socket.on("reset", () => setBuzzOrder([]));

        return () => {
            socket.off("roomCreated");
            socket.off("playerList");
            socket.off("buzzOrder");
            socket.off("reset");
        };
    }, []);

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
        setPlayers([]);
        setBuzzOrder([]);
    };

    return (
        <div className="relative w-full h-screen overflow-hidden bg-slate-950 flex items-center justify-center">
            <div className="absolute inset-0 z-0 opacity-40" style={{ backgroundImage: "url(/background.jpg)", backgroundSize: 'cover' }} />

            {/* --- ALL BOUNCING LOGOS --- */}
            {logos.map((logo, index) => (
                <div
                    key={index}
                    className="absolute z-10 pointer-events-none opacity-30"
                    style={{
                        left: logo.x,
                        top: logo.y,
                        width: DVD_SIZE,
                        height: DVD_SIZE,
                        backgroundImage: `url(${logo.src})`,
                        backgroundSize: "contain",
                        backgroundRepeat: "no-repeat",
                    }}
                />
            ))}

            <div className="relative z-20 w-full max-w-md px-6">
                {!joined ? (
                    <div className="bg-white/10 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/20 shadow-2xl flex flex-col gap-6">
                        <div className="text-center text-white">
                            <h1 className="text-4xl font-black tracking-tighter uppercase" style={{ color: '#FCA777' }}>Ready... Vardhinedi..Go !</h1>
                            <p className="text-white/60 text-sm mt-1">Ready to compete?</p>
                        </div>
                        <div className="space-y-4">
                            <input
                                className="w-full bg-white/10 border border-white/10 p-4 rounded-2xl text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-red-500 transition-all"
                                placeholder="Enter Your Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                            <input
                                className="w-full bg-white/10 border border-white/10 p-4 rounded-2xl text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-red-500 transition-all"
                                placeholder="Room ID (to join)"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-3">
                            <button
                                disabled={!name || !roomId}
                                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-95"
                                onClick={handleJoinRoom}
                            >
                                Join Room
                            </button>
                            <div className="flex items-center gap-4 my-2">
                                <div className="h-[1px] bg-white/20 flex-1"></div>
                                <span className="text-white/30 text-xs font-bold uppercase">or</span>
                                <div className="h-[1px] bg-white/20 flex-1"></div>
                            </div>
                            <button
                                disabled={!name || roomId.length > 0 || isCreating}
                                className="w-full bg-white/10 border border-white/20 hover:bg-white/20 disabled:opacity-20 text-white font-bold py-4 rounded-2xl transition-all"
                                onClick={handleCreateRoom}
                            >
                                {isCreating ? "Creating..." : "Create New Room"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-black/60 backdrop-blur-2xl p-6 md:p-8 rounded-[2.5rem] border border-white/20 shadow-2xl flex flex-col gap-4 text-white text-center w-full max-w-md max-h-[90vh]">
                        <div className="flex gap-2 -mt-2">
                            <button onClick={handleExit} className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-3 px-4 rounded-xl transition-all text-xs uppercase tracking-wider active:scale-95">
                                Exit Room
                            </button>
                            <button onClick={() => socket.emit("reset", { roomId })} className="flex-1 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 font-bold py-3 px-4 rounded-xl transition-all text-xs uppercase tracking-wider active:scale-95">
                                Reset All
                            </button>
                        </div>

                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Room Code</span>
                            <h2 className="text-5xl font-mono font-black text-white tracking-widest">{roomId}</h2>
                        </div>

                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-left">
                            <h3 className="text-xs font-bold uppercase text-white/40 mb-3 tracking-widest">Players</h3>
                            <div className="flex flex-wrap gap-2 max-h-[80px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                                {players.map((p) => (
                                    <span key={p.id} className="bg-white/10 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                        {p.name}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-left">
                            <h3 className="text-xs font-bold uppercase text-white/40 mb-3 tracking-widest">Buzz Order</h3>
                            <div className="flex flex-col gap-2 max-h-[100px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                                {buzzOrder.map((buzz, index) => {
                                    const p = players.find((player) => player.userId === buzz.userId);
                                    let displayName = p ? p.name : "Unknown";
                                    if (!p && buzz.userId === localStorage.getItem("buzzer_userId")) displayName = name + " (You)";
                                    const gap = index > 0 ? buzz.time - buzzOrder[index - 1].time : 0;
                                    const isWinner = index === 0;

                                    return (
                                        <div key={buzz.userId} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${isWinner ? 'bg-red-600/20 border-red-500' : 'bg-white/5 border-white/10'}`}>
                                            <div className="flex flex-col text-left">
                                                <span className={`font-bold text-sm ${isWinner ? 'text-white' : 'text-white/80'}`}>{displayName}</span>
                                                {index > 0 && <span className="text-[10px] text-red-400 font-mono font-bold">+{gap}ms</span>}
                                            </div>
                                            <span className={`text-xs font-black px-2 py-1 rounded ${isWinner ? 'bg-red-500 text-white' : 'bg-white/10 text-white/40'}`}>#{index + 1}</span>
                                        </div>
                                    );
                                })}
                                {buzzOrder.length === 0 && <p className="text-white/20 italic py-4 text-center text-sm">Waiting for the first buzz...</p>}
                            </div>
                        </div>

                        <div className="flex-none w-full flex justify-center py-2">
                            <button
                                onClick={handleBuzz}
                                disabled={buzzOrder.some((b) => b.userId === localStorage.getItem("buzzer_userId"))}
                                className="w-[28vh] h-[28vh] max-w-[180px] max-h-[180px] min-w-[130px] min-h-[130px] mx-auto rounded-full flex items-center justify-center bg-red-600 border-b-[10px] border-red-800 text-4xl font-black italic text-white shadow-2xl active:border-b-0 active:translate-y-[10px] transition-all disabled:opacity-50 disabled:grayscale z-50"
                            >
                                BUZZ!
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}