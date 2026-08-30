import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ChangePassword() {
  const { updatePassword } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
    } else {
      setPassword("");
      toast({ title: "Success", description: "Password updated successfully!" });
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-[#2C4C5C] flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-[#5A6E78]" /> Change Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-3 max-w-sm">
          <Input 
            type="password" 
            placeholder="New password" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={loading} className="bg-[#2C4C5C] hover:bg-[#1A313C] text-white">
            {loading ? "Updating..." : "Update"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
