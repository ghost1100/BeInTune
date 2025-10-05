import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useAuth from "@/hooks/use-auth";
import MyLearningPanel from "@/components/student/MyLearningPanel";
import DiscussionFeed from "@/components/student/DiscussionFeed";
import ChatsPanel from "@/components/student/ChatsPanel";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState("learning");

  if (loading) return null;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "student") return <Navigate to="/admin" replace />;

  const displayName = user.username || user.name || user.email;

  return (
    <div className="bg-muted/40 py-10">
      <div className="container mx-auto space-y-6">
        <header className="flex flex-col gap-1">
          <p className="text-sm text-foreground/60">Welcome back{displayName ? `, ${displayName}` : ""}</p>
          <h1 className="text-3xl font-semibold">Student dashboard</h1>
          <p className="text-sm text-foreground/70">
            Manage your lessons, join discussions, and stay connected with your tutors.
          </p>
        </header>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="w-fit">
            <TabsTrigger value="learning">My learning</TabsTrigger>
            <TabsTrigger value="discussion">Discussion</TabsTrigger>
            <TabsTrigger value="chats">Chats</TabsTrigger>
          </TabsList>

          <TabsContent value="learning" className="mt-4">
            <MyLearningPanel />
          </TabsContent>
          <TabsContent value="discussion" className="mt-4">
            <DiscussionFeed />
          </TabsContent>
          <TabsContent value="chats" className="mt-4">
            <ChatsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
