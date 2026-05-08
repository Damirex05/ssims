"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation'; // Add useRouter for redirect
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Link from 'next/link';
import { UserIcon, DocumentTextIcon, ArrowUpOnSquareIcon, ChartBarIcon, SunIcon, MoonIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface StudentData {
  matric_number: string;
  name: string;
  department: string;
  level: string;
  admission_letter: File | null;
  medical_receipt: File | null;
  school_fee_receipts: (File | null)[];
  birth_certificate: File | null;
  id_card: File | null;
  profile_picture: File | null;
}

export default function SuperAdmin() {
  const [studentData, setStudentData] = useState<StudentData>({
    matric_number: '',
    name: '',
    department: '',
    level: '',
    admission_letter: null,
    medical_receipt: null,
    school_fee_receipts: [],
    birth_certificate: null,
    id_card: null,
    profile_picture: null,
  });
  const [receiptLevels, setReceiptLevels] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string>(''); // For profile picture preview
  const [activityLog, setActivityLog] = useState({ student_id: '', behavior: '', description: '' });
  const [stats, setStats] = useState<{ totalStudents: number; completeDocs: number; ninDocs: number; recentLogs: any[] }>({
    totalStudents: 0,
    completeDocs: 0,
    ninDocs: 0,
    recentLogs: [],
  });
  const [departmentData, setDepartmentData] = useState<{ name: string; value: number }[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const router = useRouter(); // Add router for logout redirect

  useEffect(() => {
    const fetchStats = async () => {
      const { count: totalStudents } = await supabase.from('students').select('*', { count: 'exact', head: true });
      const { count: completeDocs } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'Complete');
      const { count: ninDocs } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'NIN');
      const { data: recentLogs } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(5);
      const { data: deptData } = await supabase.from('students').select('department').then(({ data }) => {
        const counts = (data ?? []).reduce((acc: Record<string, number>, { department }) => {
          acc[department] = (acc[department] || 0) + 1;
          return acc;
        }, {});
        return { data: Object.entries(counts).map(([name, value]) => ({ name, value })) };
      });
      setStats({
        totalStudents: totalStudents ?? 0,
        completeDocs: completeDocs ?? 0,
        ninDocs: ninDocs ?? 0,
        recentLogs: recentLogs ?? [],
      });
      setDepartmentData(deptData);
    };
    fetchStats();
  }, []);

  useEffect(() => {
    if (studentData.profile_picture) {
      const url = URL.createObjectURL(studentData.profile_picture);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url); // Clean up to prevent memory leaks
    } else {
      setPreviewUrl('');
    }
  }, [studentData.profile_picture]);

  const handleAddReceipt = () => {
    setReceiptLevels([...receiptLevels, '']);
    setStudentData({ ...studentData, school_fee_receipts: [...studentData.school_fee_receipts, null] });
  };

  const handleReceiptLevelChange = (index: number, value: string) => {
    const newLevels = [...receiptLevels];
    newLevels[index] = value;
    setReceiptLevels(newLevels);
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const {
      matric_number,
      name,
      department,
      level,
      admission_letter,
      medical_receipt,
      school_fee_receipts,
      birth_certificate,
      id_card,
      profile_picture,
    } = studentData;

    const documentUrls: { type: string; level: string | null; path: string }[] = [];
    const documentTypes = [
      { file: admission_letter, type: 'admission_letter', level: null as string | null },
      { file: medical_receipt, type: 'medical_receipt', level: null as string | null },
      { file: birth_certificate, type: 'birth_certificate', level: null as string | null },
      { file: id_card, type: 'id_card', level: null as string | null },
    ];

    school_fee_receipts.forEach((file, index) => {
      if (file && receiptLevels[index]) {
        documentTypes.push({ file, type: 'school_fee_receipt', level: receiptLevels[index] });
      }
    });

    for (const { file, type, level } of documentTypes) {
      if (!file) continue;
      if (file.type !== 'application/pdf') {
        alert(`Only PDF files are allowed for ${type}.`);
        return;
      }
      const path = level ? `${matric_number}/${type}/${level}/${file.name}` : `${matric_number}/${type}/${file.name}`;
      console.log('Uploading file:', path);
      const { data, error } = await supabase.storage
        .from('student-documents')
        .upload(path, file, { upsert: true });
      if (error) {
        console.error('Upload error:', error);
        alert(`Document upload failed for ${type}: ${error.message}`);
        return;
      }
      documentUrls.push({ type, level, path: data.path });
    }

    if (profile_picture) {
      if (!['image/jpeg', 'image/png'].includes(profile_picture.type)) {
        alert('Profile picture must be a JPEG or PNG image.');
        return;
      }
      if (profile_picture.size > 2 * 1024 * 1024) {
        alert('Profile picture must be less than 2MB.');
        return;
      }
      const picturePath = `${matric_number}/profile_picture/${profile_picture.name}`;
      console.log('Uploading profile picture:', picturePath);
      const { data, error } = await supabase.storage
        .from('student-documents')
        .upload(picturePath, profile_picture, { upsert: true });
      if (error) {
        console.error('Profile picture upload error:', error);
        alert('Profile picture upload failed: ' + error.message);
        return;
      }

      try {
        const { error: dbError } = await supabase
          .from('students')
          .insert({
            matric_number,
            name,
            department,
            level,
            documents: documentUrls,
            profile_picture: data.path,
            status: documentUrls.filter(doc => ['admission_letter', 'medical_receipt', 'birth_certificate', 'id_card'].includes(doc.type)).length === 4 ? 'Complete' : 'NIN',
          });
        if (dbError) {
          console.error('Database insert error:', dbError);
          alert('Student registration failed: ' + dbError.message);
          return;
        }
        alert('Student registered successfully!');
        setStudentData({
          matric_number: '',
          name: '',
          department: '',
          level: '',
          admission_letter: null,
          medical_receipt: null,
          school_fee_receipts: [],
          birth_certificate: null,
          id_card: null,
          profile_picture: null,
        });
        setReceiptLevels([]);
        const { count: totalStudents } = await supabase.from('students').select('*', { count: 'exact', head: true });
        const { count: completeDocs } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'Complete');
        const { count: ninDocs } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'NIN');
        const { data: recentLogs } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(5);
        const { data: deptData } = await supabase.from('students').select('department').then(({ data }) => {
          const counts = (data ?? []).reduce((acc: Record<string, number>, { department }) => {
            acc[department] = (acc[department] || 0) + 1;
            return acc;
          }, {});
          return { data: Object.entries(counts).map(([name, value]) => ({ name, value })) };
        });
        setStats({
          totalStudents: totalStudents ?? 0,
          completeDocs: completeDocs ?? 0,
          ninDocs: ninDocs ?? 0,
          recentLogs: recentLogs ?? [],
        });
        setDepartmentData(deptData);
      } catch (err) {
        console.error('Unexpected database error:', err);
        alert('Unexpected error during student registration');
      }
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        alert('Failed to log out. Please try again.');
        return;
      }
      router.push('/'); // Redirect to login page
    } catch (err) {
      console.error('Unexpected logout error:', err);
      alert('An unexpected error occurred during logout.');
    }
  };

  return (
    <div className={`min-h-screen bg-black font-inter transition-colors duration-300`}>
      <header className="bg-black text-white dark:bg-gray-800 shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl text-white font-bold dark:text-white flex items-center">
            <UserIcon className="h-6 w-6 mr-2" />
            Super Admin Dashboard
          </h1>
          <div className="flex items-center gap-3">
        
            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-red-600 transition"
              aria-label="Log out"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
             
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transform hover:scale-105 transition-transform">
            <div className="flex items-center">
              <UserIcon className="h-8 w-8 text-black mr-3" />
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Students</h3>
                <p className="text-3xl font-bold text-black dark:text-blue-400">{stats.totalStudents}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transform hover:scale-105 transition-transform">
            <div className="flex items-center">
              <DocumentTextIcon className="h-8 w-8 text-green-500 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Complete Documents</h3>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.completeDocs}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transform hover:scale-105 transition-transform">
            <div className="flex items-center">
              <DocumentTextIcon className="h-8 w-8 text-red-500 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">NIN Documents</h3>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.ninDocs}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Department-wise Bar Chart */}
        <div className="bg-transparent dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl text-white font-semibold dark:text-white mb-4 flex items-center">
            <ChartBarIcon className="h-6 w-6 mr-2" />
            Students by Department
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentData}>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? 'black' : 'black'} />
                <XAxis dataKey="name" stroke={darkMode ? 'white' : 'white'} />
                <YAxis stroke={darkMode ? 'white' : 'white'} />
                <Tooltip contentStyle={{ backgroundColor: darkMode ? 'black' : 'black', borderColor: darkMode ? '#4b5563' : '#e5e7eb' }} />
                <Bar dataKey="value" fill="white" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      

        {/* Navigation to Students List */}
        <div className="mb-8">
          <Link href="/super-admin/students">
            <button className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-black to-blue-700 text-white rounded-md hover:bg-black transition shadow-md">
              <UserIcon className="h-5 w-5 mr-2" />
              View All Students
            </button>
          </Link>
        </div>

        {/* Student Registration */}
        <div className="bg-black dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-white dark:text-white mb-6 flex items-center">
            <UserIcon className="h-6 w-6 mr-2" />
            Register Student
          </h2>
          <form onSubmit={handleStudentSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <div className="flex flex-col items-center gap-2">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Profile Picture Preview"
                    className="w-24 h-24 rounded-full object-cover border-2 border-white"
                  />
                ) : (
                  <div className="w-30 h-30 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center border-2 border-white">
                    <UserIcon className="h-12 w-12 text-gray-400" />
                  </div>
                )}
                <div className="relative w-full">
                  <label className="block text-sm mt-4 font-medium text-white dark:text-gray-300 mb-1">
                    Profile Picture
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    capture="user"
                    onChange={(e) => setStudentData({ ...studentData, profile_picture: e.target.files ? e.target.files[0] : null })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-black file:text-white file:hover:bg-black transition"
                  />
                  <ArrowUpOnSquareIcon className="absolute right-3 top-10 h-5 w-5 text-gray-400" />
                </div>
              </div>
              <div className="w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white dark:text-gray-300 mb-1">Matric Number</label>
                    <input
                      type="text"
                      placeholder="Enter matric number"
                      value={studentData.matric_number}
                      onChange={(e) => setStudentData({ ...studentData, matric_number: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-black focus:border-black transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white dark:text-gray-300 mb-1">Name</label>
                    <input
                      type="text"
                      placeholder="Enter full name"
                      value={studentData.name}
                      onChange={(e) => setStudentData({ ...studentData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-black focus:border-black transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white dark:text-gray-300 mb-1">Department</label>
                    <input
                      type="text"
                      placeholder="Enter department"
                      value={studentData.department}
                      onChange={(e) => setStudentData({ ...studentData, department: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-black focus:border-black transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white dark:text-gray-300 mb-1">Level</label>
                    <input
                      type="text"
                      placeholder="Enter level (e.g., 100)"
                      value={studentData.level}
                      onChange={(e) => setStudentData({ ...studentData, level: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-black focus:border-black transition"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white dark:text-gray-300 mb-1">Admission Letter (PDF)</label>
              <div className="relative">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setStudentData({ ...studentData, admission_letter: e.target.files ? e.target.files[0] : null })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-black file:text-white file:hover:bg-black transition"
                />
                <ArrowUpOnSquareIcon className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white dark:text-gray-300 mb-1">Medical Receipt/Letter (PDF)</label>
              <div className="relative">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setStudentData({ ...studentData, medical_receipt: e.target.files ? e.target.files[0] : null })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-black file:text-white file:hover:bg-black transition"
                />
                <ArrowUpOnSquareIcon className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white dark:text-gray-300 mb-1">Birth Certificate (PDF)</label>
              <div className="relative">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setStudentData({ ...studentData, birth_certificate: e.target.files ? e.target.files[0] : null })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-black file:text-white file:hover:bg-black transition"
                />
                <ArrowUpOnSquareIcon className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white dark:text-gray-300 mb-1">ID Card (PDF)</label>
              <div className="relative">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setStudentData({ ...studentData, id_card: e.target.files ? e.target.files[0] : null })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-black file:text-white file:hover:bg-black transition"
                />
                <ArrowUpOnSquareIcon className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white dark:text-gray-300 mb-1">School Fee Receipts (PDF)</label>
              {receiptLevels.map((level, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-4 mb-4">
                  <input
                    type="text"
                    placeholder="Level (e.g., 100)"
                    value={level}
                    onChange={(e) => handleReceiptLevelChange(index, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-black focus:border-black transition"
                  />
                  <div className="relative flex-1">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        const newReceipts = [...studentData.school_fee_receipts];
                        newReceipts[index] = e.target.files ? e.target.files[0] : null;
                        setStudentData({ ...studentData, school_fee_receipts: newReceipts });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-black file:text-white file:hover:bg-black transition"
                    />
                    <ArrowUpOnSquareIcon className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddReceipt}
                className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
              >
                <DocumentTextIcon className="h-5 w-5 mr-2" />
                Add School Fee Receipt
              </button>
            </div>
            <button
              type="submit"
              className="w-full px-4 py-3 bg-gradient-to-r from-black to-blue-700 text-white rounded-md hover:from-blue-700 hover:to-blue-800 transition shadow-md"
            >
              Register Student
            </button>
          </form>
        </div>

       
      </main>
    </div>
  );
}