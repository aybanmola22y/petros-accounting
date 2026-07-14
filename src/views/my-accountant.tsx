import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Building2, Calendar, MessageSquare } from "lucide-react";

export function MyAccountant() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div><h1 className="text-2xl font-bold tracking-tight">My Accountant</h1><p className="text-sm text-muted-foreground mt-1">Your assigned accounting professional</p></div>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-5">
            <Avatar className="h-16 w-16 border-2 border-border">
              <AvatarFallback className="text-xl bg-primary/10 text-primary font-semibold">SR</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-semibold">Sarah Reynolds, CPA</h2>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Available</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Reynolds & Associates Accounting Firm</p>
              <div className="grid grid-cols-1 gap-2.5">
                <div className="flex items-center gap-2.5 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>sarah.reynolds@raaccounting.com</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>+1 (415) 555-0192</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span>123 Market Street, Suite 400, San Francisco, CA 94105</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>Last activity: 2 days ago — Q1 review completed</span>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <Button size="sm" className="gap-2"><Mail className="w-3.5 h-3.5" />Send Email</Button>
                <Button size="sm" variant="outline" className="gap-2"><Phone className="w-3.5 h-3.5" />Call</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="w-4 h-4" />Notes & Messages</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {[
              { from: "Sarah Reynolds", date: "May 19, 2026", msg: "Your Q1 reconciliation is complete. I noticed a few transactions around March 15 that need your category confirmation." },
              { from: "You", date: "May 18, 2026", msg: "Hi Sarah, can you take a look at the outstanding invoices for Apex Corp? Some of them are overdue by 45+ days." },
              { from: "Sarah Reynolds", date: "May 15, 2026", msg: "Reminder: Please upload your March bank statements by end of week so we can finish the Q1 close." },
            ].map((note, i) => (
              <div key={i} className={`p-3 rounded-lg text-sm border ${note.from === "You" ? "bg-primary/5 border-primary/20 ml-8" : "bg-muted/50 border-border mr-8"}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-xs">{note.from}</span>
                  <span className="text-xs text-muted-foreground">{note.date}</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">{note.msg}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2 pt-2 border-t">
            <Textarea placeholder="Write a message to your accountant..." rows={3} className="resize-none" />
            <Button size="sm" className="gap-2"><MessageSquare className="w-3.5 h-3.5" />Send Message</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
