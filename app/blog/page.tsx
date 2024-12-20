'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import BlogPostModal from '../components/BlogPostModal';
import BlogForm from '../components/BlogForm';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import { formatDistance } from 'date-fns';
import type { BlogPost } from '../types/blog';
import { useDebounce } from '../hooks/useDebounce';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRouter, useSearchParams } from 'next/navigation';

export default function BlogPage() {
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isCreating, setIsCreating] = useState(false);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const postId = searchParams?.get('postId');
    const [sortBy, setSortBy] = useState('dateDesc'); // Options: dateDesc, dateAsc, scoreDesc, scoreAsc
    const router = useRouter();

    console.log("DEBUG: Blog page rendered, isCreating:", isCreating);

    useEffect(() => {
        const fetchPostFromId = async () => {
            if (!postId) return;

            try {
                const accessToken = localStorage.getItem('accessToken');
                const response = await fetch(`/api/blogs/${postId}`, {
                    headers: accessToken ? {
                        'Authorization': `Bearer ${accessToken}`,
                    } : {}
                });
                if (!response.ok) throw new Error('Failed to fetch post');

                const post = await response.json();
                setSelectedPost(post);
            } catch (error) {
                console.error('Error fetching post:', error);
            }
        };

        fetchPostFromId();
    }, [postId]);

    const fetchPosts = async () => {
        try {
            setLoading(true);
            const accessToken = localStorage.getItem('accessToken');
            const response = await fetch(
                `/api/blogs/search?searchTerm=${debouncedSearchTerm}&page=${currentPage}&limit=10&sortBy=${sortBy}`,
                {
                    headers: accessToken ? {
                        'Authorization': `Bearer ${accessToken}`,
                    } : {}
                }
            );
            if (!response.ok) {
                throw new Error('Failed to fetch posts');
            }
            const data = await response.json();

            setPosts(data.posts || []);
            setTotalPages(data.totalPages || 1);
        } catch (error) {
            console.error('Error fetching posts:', error);
            setPosts([]);
            setTotalPages(1);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPosts();
    }, [debouncedSearchTerm, currentPage, sortBy]);

    const handleVote = async (postId: string, type: number, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent modal from opening
        if (!user) return;

        try {
            const response = await fetch(`/api/blogs/${postId}/vote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                },
                body: JSON.stringify({
                    userId: user.id,
                    type,
                }),
            });

            if (response.ok) {
                const data = await response.json();

                // Update posts state locally instead of refetching
                setPosts(currentPosts =>
                    currentPosts.map(post => {
                        if (post.id === postId) {
                            if (data.message === "Vote removed") {
                                return {
                                    ...post,
                                    votes: post.votes.filter(vote => vote.userId !== user.id)
                                };
                            }
                            const newVotes = post.votes.filter(vote => vote.userId !== user.id);
                            return {
                                ...post,
                                votes: [...newVotes, data]
                            };
                        }
                        return post;
                    })
                );
            }
        } catch (error) {
            console.error('Error voting:', error);
        }
    };

    const handleCloseModal = () => {
        setSelectedPost(null);
        // Remove postId from URL when closing modal
        router.push('/blog');
    };

    const handleSelectPost = (post: BlogPost) => {
        setSelectedPost(post);
        // Add postId to URL when opening modal
        router.push(`/blog?postId=${post.id}`);
    };

    const handleHideContent = async (contentId: string, contentType: string, hide: boolean) => {
        try {
            const response = await fetch('/api/admin/hide-content', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ contentId, contentType, hide }),
            });

            if (!response.ok) {
                throw new Error('Failed to update content visibility');
            }

            fetchPosts();
        } catch (error) {
            console.error('Error updating content visibility:', error);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold dark:text-white">Blog Posts</h1>
                {user && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                        Create Post
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
                <div className="sm:col-span-3">
                    <SearchBar onSearch={setSearchTerm} />
                </div>
                <div className="relative">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="w-full appearance-none px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    >
                        <option value="dateDesc">Newest First</option>
                        <option value="dateAsc">Oldest First</option>
                        <option value="scoreDesc">Highest Score</option>
                        <option value="scoreAsc">Lowest Score</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 dark:text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            )}

            <div className="grid gap-6">
                {!loading && posts.map((post) => (
                    <div key={post.id} className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow ${post.hidden ? 'opacity-75' : ''}`}>
                        <div className="flex items-start gap-4">
                            <div className="flex flex-col items-center">
                                <button
                                    onClick={(e) => handleVote(post.id, 1, e)}
                                    className={`p-1 ${user?.id && post.votes.find(vote => vote.userId === user.id)?.type === 1
                                        ? 'text-blue-500'
                                        : 'text-gray-400'}`}
                                    disabled={!user}
                                >
                                    ▲
                                </button>
                                <span className="text-sm font-medium">
                                    {post.votes.reduce((acc, vote) => acc + vote.type, 0)}
                                </span>
                                <button
                                    onClick={(e) => handleVote(post.id, -1, e)}
                                    className={`p-1 ${user?.id && post.votes.find(vote => vote.userId === user.id)?.type === -1
                                        ? 'text-red-500'
                                        : 'text-gray-400'}`}
                                    disabled={!user}
                                >
                                    ▼
                                </button>
                            </div>
                            <div className="flex-1 min-w-0" onClick={() => handleSelectPost(post)}>
                                <div className="flex items-center gap-2 mb-2">
                                    <h2 className="text-xl font-bold dark:text-white hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-200">
                                        {post.title}
                                    </h2>
                                    {post.hidden && (
                                        <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded">Hidden</span>
                                    )}
                                </div>
                                <div className="h-[4.5rem] overflow-hidden relative mb-4">
                                    <div className="prose dark:prose-invert max-w-none">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            className="markdown-content"
                                        >
                                            {post.content}
                                        </ReactMarkdown>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-gray-800 to-transparent" />
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                    <span>
                                        By {post.author.firstName} {post.author.lastName}
                                    </span>
                                    <span>
                                        {formatDistance(new Date(post.createdAt), new Date(), { addSuffix: true })}
                                    </span>
                                </div>
                                <div className="flex gap-2 mt-3">
                                    {post.tags.split(',').slice(0, 3).map((tag) => (
                                        <span
                                            key={tag}
                                            className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full text-xs"
                                        >
                                            {tag.trim()}
                                        </span>
                                    ))}
                                </div>
                                {user?.isAdmin && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleHideContent(post.id, 'blogPost', !post.hidden);
                                        }}
                                        className={`mt-4 px-3 py-1 rounded ${post.hidden
                                            ? 'bg-green-500 hover:bg-green-600'
                                            : 'bg-red-500 hover:bg-red-600'} text-white transition-colors`}
                                    >
                                        {post.hidden ? 'Unhide' : 'Hide'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {selectedPost && (
                <BlogPostModal
                    post={selectedPost}
                    onClose={handleCloseModal}
                    onUpdate={fetchPosts}
                />
            )}

            <div className="mt-6">
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </div>

            {isCreating && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
                    onClick={(e) => {
                        console.log("DEBUG: Modal backdrop clicked");
                        e.stopPropagation();
                    }}
                >
                    <div
                        className="w-full max-w-2xl"
                        onClick={e => {
                            console.log("DEBUG: Modal content clicked");
                            e.stopPropagation();
                        }}
                    >
                        <BlogForm
                            onClose={() => {
                                console.log("DEBUG: BlogForm onClose called");
                                setIsCreating(false);
                            }}
                            onSubmit={() => {
                                console.log("DEBUG: BlogForm onSubmit called");
                                setIsCreating(false);
                                fetchPosts();
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
} 