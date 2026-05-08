"use client";

// File: app/super-admin/students/[matric-number]/page.tsx
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter, useParams } from 'next/navigation';
import { UserIcon, DocumentTextIcon, SunIcon, MoonIcon, TrashIcon, PencilIcon, ArrowUpOnSquareIcon, ArrowLeftIcon, CheckCircleIcon, XCircleIcon, PlayIcon, PlusIcon, DocumentIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface StudentDocument {
  path: string | File | null;
  type: string;
  level?: string | null;
}

interface Student {
  matric_number: string;
  name: string;
  department: string;
  level: string;
  status: string;
  documents: StudentDocument[];
  profile_picture: string | File | null;
}

interface ActivityLog {
  id: number;
  student_id: string;
  behavior: string;
  description: string;
  created_at: string;
}

export default function StudentDetails() {
  const { 'matric-number': matricNumber } = useParams();
  const router = useRouter();

  if (!matricNumber) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 w-full max-w-md">
          <p className="text-xl text-red-500 dark:text-red-400 font-semibold animate-pulse">Matric number not found</p>
          <button
            onClick={() => router.push('/super-admin/students')}
            className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition"
          >
            Back to Students
          </button>
        </div>
      </div>
    );
  }

  const [studentData, setStudentData] = useState<Student>({
    matric_number: '',
    name: '',
    department: '',
    level: '',
    documents: [],
    profile_picture: null,
    status: '',
  });
  const [editData, setEditData] = useState<Student | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [receiptLevels, setReceiptLevels] = useState<string[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeletePopup, setShowDeletePopup] = useState(false);

  useEffect(() => {
    const fetchStudentData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!user || authError) {
          setError('Please log in to view this page.');
          router.push('/');
          setLoading(false);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (!profile || !['admin', 'super-admin'].includes(profile.role)) {
          setError('Access denied. Admin or Super-Admin role required.');
          router.push('/');
          setLoading(false);
          return;
        }

        setIsAuthorized(true);
        setIsSuperAdmin(profile.role === 'super-admin');

        const { data: student, error: studentError } = await supabase
          .from('students')
          .select('matric_number, name, department, level, documents, profile_picture, status')
          .eq('matric_number', matricNumber)
          .maybeSingle() as { data: Student | null, error: any };

        if (studentError) {
          console.error('Student fetch error:', studentError);
          setError('Error fetching student: ' + studentError.message);
          setLoading(false);
          return;
        }

        if (!student) {
          setError('Student not found.');
          setLoading(false);
          return;
        }

        setStudentData(student);
        setEditData(null);
        if (student.profile_picture) {
          const { data: publicUrl } = supabase.storage
            .from('student-documents')
            .getPublicUrl(student.profile_picture as string);
          setProfilePictureUrl(publicUrl.publicUrl);
        }

        const existingReceipts = student.documents.filter(doc => doc.type === 'school_fee_receipt');
        setReceiptLevels(existingReceipts.map(doc => doc.level || ''));
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [matricNumber, router]);

  useEffect(() => {
    if (editData?.profile_picture instanceof File) {
      const url = URL.createObjectURL(editData.profile_picture);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (profilePictureUrl) {
      setPreviewUrl(profilePictureUrl);
    } else {
      setPreviewUrl('');
    }
  }, [editData?.profile_picture, profilePictureUrl]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        setError('Failed to log out. Please try again.');
        return;
      }
      router.push('/'); // Redirect to login page
    } catch (err) {
      console.error('Unexpected logout error:', err);
      setError('An unexpected error occurred during logout.');
    }
  };

  const getDocumentUrl = (path: string | File | null) => {
    if (!path || path instanceof File) return '#';
    const { data: publicUrl } = supabase.storage.from('student-documents').getPublicUrl(path);
    return publicUrl.publicUrl;
  };

  const handleEdit = () => {
    if (!isSuperAdmin) {
      setError('Only super-admins can edit student details.');
      return;
    }
    setEditData({
      ...studentData,
      profile_picture: studentData.profile_picture,
    });
  };

  const handleAddReceipt = () => {
    if (!isSuperAdmin) return;
    setReceiptLevels([...receiptLevels, '']);
    setEditData({
      ...editData!,
      documents: [...editData!.documents, { path: null, type: 'school_fee_receipt', level: '' }],
    });
  };

  const handleReceiptLevelChange = (index: number, value: string) => {
    if (!isSuperAdmin) return;
    const newLevels = [...receiptLevels];
    newLevels[index] = value;
    setReceiptLevels(newLevels);

    const updatedDocuments = [...editData!.documents];
    const receiptIndex = updatedDocuments.findIndex(doc => doc.type === 'school_fee_receipt' && doc.level === receiptLevels[index]);
    if (receiptIndex !== -1) {
      updatedDocuments[receiptIndex].level = value;
    } else {
      updatedDocuments.push({ path: null, type: 'school_fee_receipt', level: value });
    }
    setEditData({ ...editData!, documents: updatedDocuments });
  };

  const handleSave = async () => {
    if (!editData || !isSuperAdmin) {
      setError('Only super-admins can save changes.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const documentUrls: StudentDocument[] = [...editData.documents];
      const documentTypes: { file: string | File | null; type: string; level: string | null }[] = [
        { file: editData.documents.find(doc => doc.type === 'admission_letter')?.path ?? null, type: 'admission_letter', level: null },
        { file: editData.documents.find(doc => doc.type === 'medical_receipt')?.path ?? null, type: 'medical_receipt', level: null },
        { file: editData.documents.find(doc => doc.type === 'birth_certificate')?.path ?? null, type: 'birth_certificate', level: null },
        { file: editData.documents.find(doc => doc.type === 'id_card')?.path ?? null, type: 'id_card', level: null },
      ];

      for (let i = 0; i < receiptLevels.length; i++) {
        const file = editData.documents.find(doc => doc.type === 'school_fee_receipt' && doc.level === receiptLevels[i])?.path ?? null;
        if (file && receiptLevels[i]) {
          documentTypes.push({ file, type: 'school_fee_receipt', level: receiptLevels[i] });
        }
      }

      for (const { file, type, level } of documentTypes) {
        if (!file || !(file instanceof File)) continue;
        if (file.type !== 'application/pdf') {
          setError(`Only PDF files are allowed for ${type}.`);
          setLoading(false);
          return;
        }
        const fileName = `${editData.matric_number}/${type}${level ? `/${level}` : ''}/${file.name}`;
        const { data, error: uploadError } = await supabase.storage
          .from('student-documents')
          .upload(fileName, file, { upsert: true });
        if (uploadError) {
          setError(`Document upload failed for ${type}: ${uploadError.message}`);
          setLoading(false);
          return;
        }
        const existingDocIndex = documentUrls.findIndex(doc => doc.type === type && (!level || doc.level === level));
        if (existingDocIndex !== -1) {
          documentUrls[existingDocIndex].path = data.path;
        } else {
          documentUrls.push({ path: data.path, type, level });
        }
      }

      let profilePicturePath = editData.profile_picture;
      if (editData.profile_picture instanceof File) {
        if (!['image/jpeg', 'image/png'].includes(editData.profile_picture.type)) {
          setError('Profile picture must be a JPEG or PNG image.');
          setLoading(false);
          return;
        }
        if (editData.profile_picture.size > 2 * 1024 * 1024) {
          setError('Profile picture must be less than 2MB.');
          setLoading(false);
          return;
        }
        const fileName = `${editData.matric_number}/profile_picture/${editData.profile_picture.name}`;
        const { data, error: uploadError } = await supabase.storage
          .from('student-documents')
          .upload(fileName, editData.profile_picture, { upsert: true });
        if (uploadError) {
          setError('Profile picture upload failed: ' + uploadError.message);
          setLoading(false);
          return;
        }
        profilePicturePath = data.path;
      }

      const { error: updateError } = await supabase
        .from('students')
        .update({
          name: editData.name,
          department: editData.department,
          level: editData.level,
          status: documentUrls.filter(doc => ['admission_letter', 'medical_receipt', 'birth_certificate', 'id_card'].includes(doc.type) && doc.path).length === 5 ? 'Complete' : 'NIN',
          profile_picture: profilePicturePath,
          documents: documentUrls,
        })
        .eq('matric_number', matricNumber);

      if (updateError) {
        console.error('Update error:', updateError);
        setError('Error updating student: ' + updateError.message);
        setLoading(false);
        return;
      }

      setStudentData({
        ...editData,
        documents: documentUrls,
        profile_picture: profilePicturePath,
        status: documentUrls.filter(doc => ['admission_letter', 'medical_receipt', 'birth_certificate', 'id_card'].includes(doc.type) && doc.path).length === 5 ? 'Complete' : 'NIN',
      });
      setProfilePictureUrl(profilePicturePath ? supabase.storage.from('student-documents').getPublicUrl(profilePicturePath as string).data.publicUrl : '');
      setEditData(null);
      setReceiptLevels(documentUrls.filter(doc => doc.type === 'school_fee_receipt').map(doc => doc.level || ''));

      await supabase.from('activity_logs').insert({
        student_id: matricNumber,
        behavior: 'Good',
        description: 'Student details updated by super-admin',
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred during save.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isSuperAdmin) {
      setError('Only super-admins can delete student records.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('matric_number', matricNumber);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        setError('Error deleting student: ' + deleteError.message);
        setLoading(false);
        return;
      }

      await supabase.from('activity_logs').delete().eq('student_id', matricNumber);

      if (studentData.profile_picture && typeof studentData.profile_picture === 'string') {
        await supabase.storage.from('student-documents').remove([studentData.profile_picture]);
      }
      for (const doc of studentData.documents) {
        if (doc.path && typeof doc.path === 'string') {
          await supabase.storage.from('student-documents').remove([doc.path]);
        }
      }

      setError('Student deleted successfully.');
      router.push('/super-admin/students');
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred during deletion.');
      setLoading(false);
    }
  };

  if (!isAuthorized || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          <p className="text-lg text-gray-700 dark:text-gray-300">{loading ? 'Loading...' : 'Unauthorized'}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 w-full max-w-md">
          <p className="text-xl text-red-500 dark:text-red-400 font-semibold animate-pulse">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-black dark:bg-gray-900 font-inter transition-colors duration-300`}>
      {/* Header */}
      <header className="bg-black shadow-lg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-full bg-white/20 dark:bg-gray-700/20 text-white hover:bg-white/30 dark:hover:bg-gray-600/30 transition-all duration-300"
              aria-label="Go back"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
              <UserIcon className="h-6 w-6" />
              {studentData.name || 'Student Details'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <>
                <button
                  onClick={editData ? handleSave : handleEdit}
                  className="flex items-center px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-all duration-300"
                  aria-label={editData ? 'Save changes' : 'Edit student'}
                >
                  {editData ? (
                    <>
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      Save
                    </>
                  ) : (
                    <>
                      <PencilIcon className="h-5 w-5 mr-2" />
                      Edit
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowDeletePopup(true)}
                  className="flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-300"
                  aria-label="Delete student"
                >
                  <TrashIcon className="h-5 w-5 mr-2" />
                  Delete
                </button>
              </>
            )}
            <button
              onClick={handleLogout}
              className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              aria-label="Log out"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Delete Confirmation Modal */}
      {showDeletePopup && isSuperAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl animate-fade-in">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Confirm Deletion</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete the student record for <span className="font-semibold">{studentData.name}</span> ({studentData.matric_number})? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeletePopup(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDelete();
                  setShowDeletePopup(false);
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-300"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Student Details Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8 transform hover:scale-[1.01] transition-all duration-300">
          {editData && isSuperAdmin ? (
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                <div className="flex flex-col items-center gap-4">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Profile Picture Preview"
                      className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4 border-indigo-500 dark:border-indigo-400 shadow-md"
                    />
                  ) : (
                    <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-4 border-indigo-500 dark:border-indigo-400">
                      <UserIcon className="h-16 w-16 text-gray-400" />
                    </div>
                  )}
                  <div className="relative w-full max-w-xs">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Profile Picture (JPEG/PNG, max 2MB)
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        capture="user"
                        onChange={(e) => setEditData({ ...editData, profile_picture: e.target.files ? e.target.files[0] : null })}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-500 file:text-white file:hover:bg-indigo-600 transition-all duration-300"
                      />
                      <PlayIcon className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </div>
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Matric Number</label>
                    <input
                      type="text"
                      value={editData.matric_number}
                      disabled
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Department</label>
                    <input
                      type="text"
                      value={editData.department}
                      onChange={(e) => setEditData({ ...editData, department: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Level</label>
                    <input
                      type="text"
                      value={editData.level}
                      onChange={(e) => setEditData({ ...editData, level: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-300"
                    />
                  </div>
                </div>
              </div>
              {['admission_letter', 'medical_receipt', 'birth_certificate', 'id_card'].map((type) => (
                <div key={type}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} (PDF)
                    <span className={`ml-2 text-sm ${editData.documents.some(doc => doc.type === type && doc.path) ? 'text-green-500' : 'text-red-500'}`}>
                      {editData.documents.some(doc => doc.type === type && doc.path) ? '(Uploaded)' : '(Missing)'}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        const file = e.target.files ? e.target.files[0] : null;
                        const updatedDocuments = [...editData.documents];
                        const index = updatedDocuments.findIndex(doc => doc.type === type);
                        if (index !== -1) {
                          updatedDocuments[index] = { path: file, type, level: null };
                        } else {
                          updatedDocuments.push({ path: file, type, level: null });
                        }
                        setEditData({ ...editData, documents: updatedDocuments });
                      }}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-500 file:text-white file:hover:bg-indigo-600 transition-all duration-300"
                    />
                    <PlayIcon className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
                  </div>
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">School Fee Receipts (PDF)</label>
                {receiptLevels.map((level, index) => (
                  <div key={index} className="flex flex-col sm:flex-row gap-4 mb-4">
                    <input
                      type="text"
                      placeholder="Level (e.g., 100)"
                      value={level}
                      onChange={(e) => handleReceiptLevelChange(index, e.target.value)}
                      className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-300"
                    />
                    <div className="relative flex-1">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          const file = e.target.files ? e.target.files[0] : null;
                          const updatedDocuments = [...editData.documents];
                          const receiptIndex = updatedDocuments.findIndex(doc => doc.type === 'school_fee_receipt' && doc.level === receiptLevels[index]);
                          if (receiptIndex !== -1) {
                            updatedDocuments[receiptIndex] = { path: file, type: 'school_fee_receipt', level: receiptLevels[index] };
                          } else {
                            updatedDocuments.push({ path: file, type: 'school_fee_receipt', level: receiptLevels[index] });
                          }
                          setEditData({ ...editData, documents: updatedDocuments });
                        }}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-500 file:text-white file:hover:bg-indigo-600 transition-all duration-300"
                      />
                      <PlayIcon className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddReceipt}
                  className="inline-flex items-center px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-all duration-300"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Add School Fee Receipt
                </button>
              </div>
              <button
                type="submit"
                className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-md"
              >
                Save Changes
              </button>
            </form>
          ) : (
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {profilePictureUrl ? (
                <img
                  src={profilePictureUrl}
                  alt="Profile Picture"
                  className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4 border-indigo-500 dark:border-indigo-400 shadow-md"
                />
              ) : (
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-4 border-indigo-500 dark:border-indigo-400">
                  <UserIcon className="h-16 w-16 text-gray-400" />
                </div>
              )}
              <div className="w-full space-y-3">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{studentData.name || 'Loading...'}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-semibold">Matric Number:</span> {studentData.matric_number}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-semibold">Department:</span> {studentData.department}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-semibold">Level:</span> {studentData.level}
                  </p>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <span>Status:</span>
                    <span className={studentData.status === 'Complete' ? 'text-green-500' : 'text-red-500'}>
                      {studentData.status}
                      {studentData.status === 'Complete' ? (
                        <CheckCircleIcon className="h-5 w-5 inline ml-1" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 inline ml-1" />
                      )}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Documents Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8 transform hover:scale-[1.01] transition-all duration-300">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
            <DocumentIcon className="h-6 w-6 mr-2 text-indigo-500" />
            Uploaded Documents
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {studentData.documents.length > 0 ? (
              studentData.documents.map((doc, index) => (
                <a
                  key={index}
                  href={getDocumentUrl(doc.path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all duration-300 border border-gray-200 dark:border-gray-600"
                >
                  <DocumentTextIcon className="h-6 w-6 text-indigo-500 mr-3" />
                  <div>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                      {doc.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      {doc.level ? ` (Level ${doc.level})` : ''}
                    </span>
                    <p className={`text-sm ${doc.path ? 'text-green-500' : 'text-red-500'}`}>
                      {doc.path ? 'Uploaded' : 'Missing'}
                    </p>
                  </div>
                </a>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 col-span-full">No documents uploaded.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}