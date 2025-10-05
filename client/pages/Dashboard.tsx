import React, { useState } from "react";
import useAuth from "@/hooks/use-auth";
import Discussion from "./Discussion";
import MyLearning from "./MyLearning";
import Chats from "./Chats";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"learning" | "discussion" | "chats">(
    "learning",
  );

  if (loading) return null;
  if (!user) return null;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-semibold">My Dashboard</h1>
      <div className="mt-4 flex gap-2">
        <button
          className={`px-3 py-1 rounded ${tab === "learning" ? "bg-primary/10" : ""}`}
          onClick={() => setTab("learning")}
        >
          My Learning
        </button>
        <button
          className={`px-3 py-1 rounded ${tab === "discussion" ? "bg-primary/10" : ""}`}
          onClick={() => setTab("discussion")}
        >
          Discussion
        </button>
        <button
          className={`px-3 py-1 rounded ${tab === "chats" ? "bg-primary/10" : ""}`}
          onClick={() => setTab("chats")}
        >
          Chats
        </button>
      </div>

      <div className="mt-6">
        {tab === "learning" && <MyLearning />}
        {tab === "discussion" && <Discussion />}
        {tab === "chats" && <Chats />}
      </div>
    </div>
  );
}
