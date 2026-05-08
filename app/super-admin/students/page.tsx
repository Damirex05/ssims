
"use client";

// File: app/student/page.js
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { UserIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Student {
  matric_number: string;
  name: string;
  department: string;
  level: string;
  status: string;
}

export default function StudentList() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState({ department: '', level: '', status: '' });
  const [darkMode, setDarkMode] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false); // For subtle loading feedback
  const router = useRouter();

  useEffect(() => {
    const fetchStudents = async () => {
      setIsFetching(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!user || authError) {
        alert('Please log in to view the student list.');
        router.push('/');
        setIsFetching(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || ![ 'super-admin'].includes(profile.role)) {
        alert('Access denied.  Super-Admin role required.');
        router.push('/');
        setIsFetching(false);
        return;
      }

      setIsAuthorized(true);

      let query = supabase
        .from('students')
        .select('matric_number, name, department, level, status')
        .order('matric_number', { ascending: true });

      if (search) {
        query = query.or(`name.ilike.%${search.trim()}%,matric_number.ilike.%${search.trim()}%`);
      }
      if (filter.department) query = query.eq('department', filter.department.trim());
      if (filter.level) query = query.eq('level', filter.level.trim());
      if (filter.status) query = query.eq('status', filter.status);

      const { data: studentsData, error: studentsError } = await query as { data: Student[] | null, error: any };

      if (studentsError) {
        console.error('Supabase error:', studentsError);
        setError(`Error: ${studentsError.message}`);
        setIsFetching(false);
        return;
      }

      setStudents(studentsData || []);
      setIsFetching(false);
    };

    fetchStudents();
  }, [search, filter, router]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  // if (!isAuthorized) {
  //   return (
  //     <div className="min-h-screen bg-gray-100 dark:bg-gray-900 font-inter flex items-center justify-center">
  //       <p className="text-xl text-gray-900 dark:text-white">Unauthorized</p>
  //     </div>
  //   );
  // }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 font-inter flex items-center justify-center">
        <p className="text-xl text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-black font-inter transition-colors duration-300`}>
      <div className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              aria-label="Go back"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <UserIcon className="h-6 w-6 mr-2" />
              Student List
            </h1>
          </div>
          {/* <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
          </button> */}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col sm:flex-row gap-4 flex-wrap relative">
          <input
            type="text"
            placeholder="Search by name or matric number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 p-2 border bg-white py-4 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {/* <input
            type="text"
            placeholder="Department (e.g., Computer Science)"
            value={filter.department}
            onChange={(e) => setFilter({ ...filter, department: e.target.value })}
            className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Level (e.g., 100)"
            value={filter.level}
            onChange={(e) => setFilter({ ...filter, level: e.target.value })}
            className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          /> */}
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="flex-1 p-2 bg-white py-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 "
          >
            <option value="">All Status</option>
            <option value="Complete">Complete</option>
            <option value="NIN">NIN</option>
          </select>
          {isFetching && (
            <div className="absolute right-0 top-0 mt-2 mr-2">
              <svg
                className="animate-spin h-5 w-5 text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <p className='flex justify-center font-bold text-20 border bg-black text-white rounded mb-4 p-2 text-center'>click on the matric number to view each student details </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left table-auto">
              <thead>
                <tr className="border-b border-gray-700 ">
                  <th className="py-3 px-4 text-sm font-bold text-gray-500 dark:text-gray-400 ">Matric Number</th>
                  <th className="py-3 px-4 text-sm font-bold text-gray-500 dark:text-gray-400">Name</th>
                  <th className="py-3 px-4 text-sm font-bold text-gray-500 dark:text-gray-400">Department</th>
                  <th className="py-3 px-4 text-sm font-bold text-gray-500 dark:text-gray-400">Level</th>
                  <th className="py-3 px-4 text-sm font-bold text-gray-500 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.length > 0 ? (
                  students.map((student) => (
                    <tr
                      key={student.matric_number}
                      className="border-b border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                      <td className="py-3 px-4">
                        <Link
                          href={`students/${student.matric_number}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                          onClick={() => console.log('Navigating to:', student.matric_number)}
                        >
                          {student.matric_number}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{student.name}</td>
                      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{student.department}</td>
                      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{student.level}</td>
                      <td
                        className={`py-3 px-4 ${
                          student.status === 'Complete'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {student.status}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-3 px-4 text-center text-gray-500 dark:text-gray-400">
                      No students found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
