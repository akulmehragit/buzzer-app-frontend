"use client";

import React, { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

const socket: Socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000");
const DVD_SIZE = 200;

interface BuzzEntry {
    userId: string;
    time: number;
}

export default function Home() {
    const [roomId, setRoomId] = useState("");
    const [name, setName] = useState("");
    const [players, setPlayers] = useState<{ id: string, name: string }[]>([]);
    const [buzzOrder, setBuzzOrder] = useState<BuzzEntry[]>([]);
    const [joined, setJoined] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const [pos, setPos] = useState({ x: 50, y: 50 });
    const [vel, setVel] = useState({ x: 2, y: 2 });

    // Inside your Home component
    useEffect(() => {
        const savedName = localStorage.getItem("buzzer_name");
        const savedRoom = localStorage.getItem("buzzer_roomId");
        const savedId = localStorage.getItem("buzzer_userId") || Math.random().toString(36).substring(7);

        // Save ID if it's new
        localStorage.setItem("buzzer_userId", savedId);

        if (savedName && savedRoom) {
            setName(savedName);
            setRoomId(savedRoom);
            // Tell the server we are back
            socket.emit("rejoinRoom", { roomId: savedRoom, name: savedName, userId: savedId });
            setJoined(true);
        }
    }, []);

    // Update your Join/Create functions to save to localStorage
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

    // DVD animation fixed logic
    useEffect(() => {
        const interval = setInterval(() => {
            setPos((pos) => {
                const width = window.innerWidth - DVD_SIZE;
                const height = window.innerHeight - DVD_SIZE;

                let newX = pos.x + vel.x;
                let newY = pos.y + vel.y;
                let vx = vel.x;
                let vy = vel.y;

                if (newX <= 0 || newX >= width) vx = -vx;
                if (newY <= 0 || newY >= height) vy = -vy;

                setVel({ x: vx, y: vy });
                return { x: newX, y: newY };
            });
        }, 16);
        return () => clearInterval(interval);
    }, [vel]);

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
        // GET THE ID FROM LOCALSTORAGE
        const userId = localStorage.getItem("buzzer_userId");
        localStorage.setItem("buzzer_name", name);

        // SEND IT TO THE SERVER
        socket.emit("createRoom", { name, userId });
    };

    const handleExit = () => {
        // 1. Tell the server we are leaving
        const userId = localStorage.getItem("buzzer_userId");
        socket.emit("leaveRoom", { roomId, userId });

        // 2. Clear local persistence
        localStorage.removeItem("buzzer_name");
        localStorage.removeItem("buzzer_roomId");
        // Note: We keep "buzzer_userId" so the browser remembers who you are generally

        // 3. Reset local state to show the Join/Create screen
        setJoined(false);
        setRoomId("");
        setPlayers([]);
        setBuzzOrder([]);
    };

    return (
        <div className="relative w-full h-screen overflow-hidden bg-slate-950 flex items-center justify-center">
            <div className="absolute inset-0 z-0 opacity-40" style={{ backgroundImage: "url(/background.jpg)", backgroundSize: 'cover' }} />

            {/* Bouncing DVD logo */}
            <div className="absolute z-50" style={{ left: pos.x, top: pos.y, width: DVD_SIZE, height: DVD_SIZE, backgroundImage: "url(/dvd.png)", backgroundSize: "contain", backgroundRepeat: "no-repeat" }} />

            <div className="relative z-20 w-full max-w-md px-6">
                {!joined ? (
                    /* JOIN OR CREATE SCREEN */
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
                    /* GAME MODAL */
                    <div className="bg-black/60 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/20 shadow-2xl flex flex-col gap-6 text-white text-center">
                        <button
                            onClick={handleExit}
                            className="mt-6 text-white/20 hover:text-red-400 transition-colors text-[10px] font-black uppercase tracking-[0.2em]"
                        >
                            Exit Room
                        </button>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Room Code</span>
                            <h2 className="text-5xl font-mono font-black text-white tracking-widest">{roomId}</h2>
                        </div>

                        {/* Players In Room */}
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-left">
                            <h3 className="text-xs font-bold uppercase text-white/40 mb-3 tracking-widest">Players In Room</h3>
                            <div className="flex flex-wrap gap-2">
                                {players.map((p) => (
                                    <span key={p.id} className="bg-white/10 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                        {p.name}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Buzz Order */}
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-left">
                            <h3 className="text-xs font-bold uppercase text-white/40 mb-3 tracking-widest">Buzz Order</h3>
                            <div className="flex flex-col gap-2">
                                {buzzOrder.map((buzz, index) => {
                                    const p = players.find((player) => player.id === buzz.userId);

                                    let displayName = p ? p.name : "Unknown";
                                    if (!p && buzz.userId === localStorage.getItem("buzzer_userId")) {
                                        displayName = name + " (You)";
                                    }

                                    // Calculate timing gap
                                    const gap = index > 0 ? buzz.time - buzzOrder[index - 1].time : 0;
                                    const isWinner = index === 0;

                                    return (
                                        <div
                                            key={buzz.userId}
                                            className={`flex justify-between items-center p-3 rounded-xl border transition-all ${isWinner
                                                ? 'bg-red-600/20 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                                : 'bg-white/5 border-white/10'
                                                }`}
                                        >
                                            <div className="flex flex-col text-left">
                                                <span className={`font-bold text-sm ${isWinner ? 'text-white' : 'text-white/80'}`}>
                                                    {displayName}
                                                </span>
                                                {index > 0 && (
                                                    <span className="text-[10px] text-red-400 font-mono font-bold">
                                                        +{gap}ms slower
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {isWinner && (
                                                    <span className="text-[10px] font-black text-red-500 animate-pulse tracking-tighter">
                                                        WINNER
                                                    </span>
                                                )}
                                                <span className={`text-xs font-black px-2 py-1 rounded ${isWinner ? 'bg-red-500 text-white' : 'bg-white/10 text-white/40'
                                                    }`}>
                                                    #{index + 1}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {buzzOrder.length === 0 && (
                                    <p className="text-white/20 italic py-4 text-center text-sm">Waiting for the first buzz...</p>
                                )}
                            </div>
                        </div>

                        <button
                            className="z-100 w-full aspect-square bg-red-600 rounded-full border-b-[10px] border-red-800 text-4xl font-black italic shadow-2xl active:border-b-0 active:translate-y-[10px] transition-all flex items-center justify-center disabled:opacity-50 disabled:grayscale"
                            onClick={handleBuzz}
                            disabled={buzzOrder.some(b => b.userId === localStorage.getItem("buzzer_userId"))}
                        >
                            BUZZ!
                        </button>

                        <button onClick={() => socket.emit("reset", { roomId })} className="text-white/30 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest mt-2">
                            Reset All
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}