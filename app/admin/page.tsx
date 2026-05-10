"use client";

// File: app/admin/page.js
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { UserIcon, DocumentTextIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

// Lazy initialize Supabase client - only on client side
let supabaseClient: any = null;

const getSupabaseClient = () => {
  if (!supabaseClient && typeof window !== 'undefined') {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase environment variables are missing');
    }
    
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
};

interface StudentDocument {
  path: string;
  type: string;
  level?: string;
}

interface Student {
  matric_number: string;
  name: string;
  department: string;
  level: string;
  status: string;
  documents: StudentDocument[];
  profile_picture: string;
}

export default function Admin() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState({ department: '', level: '', status: '' });
  const [isFetching, setIsFetching] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    const supabase = getSupabaseClient();
    
    const fetchData = async () => {
      setIsFetching(true);
      setError(null);

      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (!user || authError) {
          setError('Please log in to view this page.');
          router.push('/');
          setIsFetching(false);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (!profile || !['admin', 'super-admin'].includes(profile.role)) {
          setError('Access denied. Admin required.');
          router.push('/');
          setIsFetching(false);
          return;
        }

        setIsAuthorized(true);

        let query = supabase
          .from('students')
          .select('matric_number, name, department, level, status, documents, profile_picture')
          .order('matric_number', { ascending: true });

        if (search) {
          query = query.or(`name.ilike.%${search.trim()}%,matric_number.ilike.%${search.trim()}%`);
        }
        if (filter.department) query = query.eq('department', filter.department.trim());
        if (filter.level) query = query.eq('level', filter.level.trim());
        if (filter.status) query = query.eq('status', filter.status);

        const { data, error } = await query;
        
        if (error) {
          console.error('Error fetching students:', error);
          setError('Error fetching students: ' + error.message);
        } else {
          setStudents(data || []);
        }
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError('Failed to load data: ' + (err.message || 'Unknown error'));
      } finally {
        setIsFetching(false);
      }
    };
    
    fetchData();
  }, [search, filter, router]);

  const fetchStudentDetails = async (matricNumber: string) => {
    if (typeof window === 'undefined') return;
    
    const supabase = getSupabaseClient();
    setIsFetching(true);
    setError(null);

    try {
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('matric_number, name, department, level, documents, profile_picture, status')
        .eq('matric_number', matricNumber)
        .maybeSingle();

      if (studentError) {
        console.error('Student Error:', studentError);
        setError('Error fetching student: ' + studentError.message);
        setIsFetching(false);
        return;
      }

      if (!student) {
        setError('Student not found.');
        setIsFetching(false);
        return;
      }

      setSelectedStudent(student);
      if (student.profile_picture) {
        const { data: publicUrl } = supabase.storage
          .from('student-documents')
          .getPublicUrl(student.profile_picture);
        setProfilePictureUrl(publicUrl.publicUrl);
      } else {
        setProfilePictureUrl('');
      }
    } catch (err: any) {
      console.error('Fetch student details error:', err);
      setError('Failed to load student details: ' + (err.message || 'Unknown error'));
    } finally {
      setIsFetching(false);
    }
  };

  const handleLogout = async () => {
    if (typeof window === 'undefined') return;
    
    const supabase = getSupabaseClient();
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        setError('Failed to log out. Please try again.');
        return;
      }
      router.push('/');
    } catch (err: any) {
      console.error('Unexpected logout error:', err);
      setError('An unexpected error occurred during logout.');
    }
  };

  const getDocumentUrl = (path: string) => {
    if (typeof window === 'undefined') return '#';
    const supabase = getSupabaseClient();
    const { data: publicUrl } = supabase.storage.from('student-documents').getPublicUrl(path);
    return publicUrl.publicUrl;
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 font-inter flex items-center justify-center">
        <p className="text-xl text-gray-900 dark:text-white">Unauthorized</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 font-inter flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 w-full max-w-md">
          <p className="text-xl text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black font-inter transition-colors duration-300 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="bg-black shadow-md sticky top-0 z-10 mb-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-white flex items-center">
              <UserIcon className="h-6 w-6 mr-2" />
              Admin Dashboard
            </h1>
            <div className="flex items-center gap-3">
              <button
                onClick={handleLogout}
                className="p-2 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition"
                aria-label="Log out"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <div className="mb-6 flex flex-col sm:flex-row gap-4 flex-wrap relative">
          <input
            type="text"
            placeholder="Search by name or matric number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-gray-300 p-2 py-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="flex-1 p-2 py-4 bg-gray-300 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="">All Status</option>
            <option value="Complete">Complete</option>
            <option value="NIN">Not Complete</option>
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

        <div className="bg-gray-300 rounded-lg shadow-md p-6 mb-8 overflow-x-auto">
          <p className="flex justify-center font-bold text-20 border bg-black text-white rounded mb-4 py-2">
            click to view each student details
          </p>
          <table className="w-full text-left table-auto">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 px-4 text-sm font-bold text-gray-500">Matric Number</th>
                <th className="py-3 px-4 text-sm font-bold text-gray-500">Name</th>
                <th className="py-3 px-4 text-sm font-bold text-gray-500">Department</th>
                <th className="py-3 px-4 text-sm font-bold text-gray-500">Level</th>
                <th className="py-3 px-4 text-sm font-bold text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.length > 0 ? (
                students.map((student) => (
                  <tr
                    key={student.matric_number}
                    onClick={() => fetchStudentDetails(student.matric_number)}
                    className="border-b border-gray-200 hover:bg-gray-100 cursor-pointer"
                  >
                    <td className="py-3 px-4 text-gray-900">{student.matric_number}</td>
                    <td className="py-3 px-4 text-gray-900">{student.name}</td>
                    <td className="py-3 px-4 text-gray-900">{student.department}</td>
                    <td className="py-3 px-4 text-gray-900">{student.level}</td>
                    <td
                      className={`py-3 px-4 ${
                        student.status === 'Complete'
                          ? 'text-green-600 font-medium'
                          : 'text-red-600 font-medium'
                      }`}
                    >
                      {student.status}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-3 px-4 text-center text-gray-500">
                    No students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedStudent && (
          <div className="bg-gray-300 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <UserIcon className="h-6 w-6 mr-2" />
              Student Details
            </h2>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {profilePictureUrl && (
                <img
                  src={profilePictureUrl}
                  alt="Profile Picture"
                  className="w-24 h-24 rounded-full object-cover border-2 border-blue-500"
                />
              )}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {selectedStudent.name || 'Loading...'}
                </h3>
                <p className="text-sm text-gray-500">Matric Number: {selectedStudent.matric_number}</p>
                <p className="text-sm text-gray-500">Department: {selectedStudent.department}</p>
                <p className="text-sm text-gray-500">Level: {selectedStudent.level}</p>
                <p
                  className={`text-sm font-medium ${
                    selectedStudent.status === 'Complete'
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  Status: {selectedStudent.status}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <DocumentTextIcon className="h-6 w-6 mr-2" />
                Uploaded Documents
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedStudent.documents && selectedStudent.documents.length > 0 ? (
                  selectedStudent.documents.map((doc, index) => (
                    <a
                      key={index}
                      href={getDocumentUrl(doc.path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center p-4 border border-gray-400 rounded-md hover:bg-gray-100 transition"
                    >
                      <DocumentTextIcon className="h-5 w-5 text-blue-500 mr-2" />
                      <span className="text-gray-900">
                        {doc.type.replace('_', ' ').toUpperCase()} {doc.level ? `(${doc.level})` : ''}
                      </span>
                    </a>
                  ))
                ) : (
                  <p className="text-gray-500">No documents available.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}