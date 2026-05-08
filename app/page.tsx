"use client";

// File: app/page.js
import { useState, useEffect } from 'react';
import { createClient, User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { SunIcon, MoonIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import logo from '../public/logo.png'; // Adjust the path as necessary

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Supabase environment variables are not defined');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // New state for password toggle
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async (retries = 3, delay = 1000) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          setLoading(true);
          setError(null);

          // Check for active session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) {
            console.error(`Session check error (attempt ${attempt}/${retries}):`, sessionError.message);
            if (attempt === retries) {
              setError('Failed to verify session. Please try again later.');
              setLoading(false);
              return;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          if (!session || !session.user) {
            setLoading(false);
            return; // Stay on login page if no user is logged in
          }

          setUser(session.user);

          // Fetch profile from profiles table
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

          if (profileError || !profile) {
            console.error('Profile fetch error:', profileError?.message || 'No profile found');
            setError('Profile not found. Please contact support.');
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }

          console.log('User profile:', { id: session.user.id, role: profile.role });

          // Redirect based on role
          switch (profile.role) {
            case 'student':
              setError('Access denied. Student accounts cannot log in.');
              await supabase.auth.signOut();
              setLoading(false);
              break;
            case 'admin':
              router.replace('/admin');
              break;
            case 'super-admin':
              router.replace('/super-admin');
              break;
            default:
              console.error('Invalid role:', profile.role);
              setError('Invalid role. Please contact support.');
              await supabase.auth.signOut();
              setLoading(false);
          }
          return; // Exit after successful check
        } catch (err) {
          console.error(`Unexpected error in checkUser (attempt ${attempt}/${retries}):`, err);
          if (attempt === retries) {
            setError('An unexpected error occurred. Please try again later.');
            setLoading(false);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    };

    checkUser();
  }, [router]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      // Attempt login
      const { data: { user }, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError || !user) {
        console.error('Login error:', loginError?.message || 'No user returned');
        setError('Login failed: ' + (loginError?.message || 'Invalid credentials.'));
        setLoading(false);
        return;
      }

      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('Profile fetch error after login:', profileError?.message || 'No profile found');
        setError('Profile not found. Please contact support.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      console.log('Logged in user:', { id: user.id, role: profile.role });

      // Redirect based on role
      switch (profile.role) {
        case 'student':
          setError('Access denied. Student accounts cannot log in.');
          await supabase.auth.signOut();
          setLoading(false);
          break;
        case 'admin':
          router.replace('/admin');
          break;
        case 'super-admin':
          router.replace('/super-admin');
          break;
        default:
          console.error('Invalid role:', profile.role);
          setError('Invalid role. Please contact support.');
          await supabase.auth.signOut();
          setLoading(false);
      }
    } catch (err) {
      console.error('Unexpected error in handleLogin:', err);
      setError('An unexpected error occurred during login. Please try again.');
      setLoading(false);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gray-100'} font-inter flex items-center justify-center transition-colors duration-300`}>
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-xl text-gray-900 dark:text-white">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gray-100'} font-inter flex items-center justify-center transition-colors duration-300`}>
        <div className="bg-gray-500 dark:bg-gray-800 rounded-lg shadow-md p-8 w-full max-w-md">
          <p className="text-xl text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-4 px-4 py-2 bg-black text-white rounded-md hover:bg-blue-700 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-black font-inter flex items-center justify-center transition-colors duration-300`}>
      <div className="bg-gray-500 dark:bg-gray-800 rounded-lg shadow-md p-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Image
            src={logo}
            alt="SSIMS Logo"
            width={100}
            height={100}
            className="rounded-full"
          />
        </div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center">Secure Student Information Management System</h1>
          {/* <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
          </button> */}
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              placeholder="Enter email"
              disabled={loading}
            />
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              placeholder="Enter password"
              disabled={loading}
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="absolute right-3 top-9 h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
            </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full px-4 py-3 bg-black text-white rounded-md hover:from-blue-700 hover:to-blue-800 transition shadow-md ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}