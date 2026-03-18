"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 Starting password update process...');
      
      // Update the password
      console.log('🔐 Updating password...');
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) {
        console.error('❌ Password update failed:', passwordError);
        throw passwordError;
      }
      console.log('✅ Password updated successfully');

      // Update first_login status after successful password update
      console.log('👤 Getting current user to update first_login...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('❌ Failed to get user:', userError);
        // Don't throw error here as password was updated successfully
      } else if (user) {
        console.log('✅ User retrieved:', user.id);
        console.log('🔄 Updating first_login status directly...');
        
        // Try direct database update first
        const { data: updateData, error: updateError } = await supabase
          .from('users')
          .update({ first_login: false })
          .eq('id', user.id)
          .select();

        if (updateError) {
          console.error('❌ Direct update failed:', updateError);
          
          // Check if it's the infinite recursion error
          if (updateError.code === '42P17') {
            console.error('❌ Infinite recursion detected in RLS policies!');
            console.log('📋 Please run the SQL fix script in Supabase SQL editor');
          }
          
          // Fallback: Try API endpoint
          console.log('🔄 Trying API endpoint fallback...');
          try {
            const response = await fetch('/api/users/update-first-login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ userId: user.id }),
            });

            if (response.ok) {
              const result = await response.json();
              console.log('✅ Successfully updated first_login via API:', result);
            } else {
              console.error('❌ API endpoint also failed:', response.status, response.statusText);
              // Try to get the response text to see what's being returned
              const responseText = await response.text();
              console.error('❌ API response text:', responseText);
            }
          } catch (apiError) {
            console.error('❌ API call failed:', apiError);
          }
        } else {
          console.log('✅ Successfully updated first_login directly:', updateData);
        }
      }

      console.log('🔄 Redirecting to protected dashboard...');
      
      // Show success state
      setIsSuccess(true);
      
      // Add a small delay to ensure database updates are complete
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Force a page refresh to ensure authentication state is updated
      console.log('🔄 Refreshing page and redirecting...');
      window.location.href = "/protected";
    } catch (error: unknown) {
      console.error('❌ Password update process failed:', error);
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      console.log('🔄 Setting loading to false');
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Set Your Password</CardTitle>
          <CardDescription>
            Welcome! Please set your password to complete your account setup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleForgotPassword}>
            <div className="flex flex-col gap-6">
              <div className="gap-2 grid">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              {isSuccess && <p className="text-green-600 text-sm text-center">✅ Password updated successfully! Redirecting to dashboard...</p>}
              <Button type="submit" className="w-full" disabled={isLoading || isSuccess}>
                {isSuccess ? "✅ Setup Complete!" : isLoading ? "Setting up..." : "Complete Setup"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
