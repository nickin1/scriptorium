import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

export default async function handler(req, res) {
    const { page = 1, limit = 10 } = req.query;

    if (req.method === 'GET') {
        // Get session using NextAuth
        const session = await getServerSession(req, res, authOptions);

        // Check if user is authenticated and is admin
        if (!session?.user?.isAdmin) {
            return res.status(403).json({ error: "Unauthorized access" });
        }

        const skip = (page - 1) * limit;
        const takeLimit = Number(limit);

        try {
            // Get total count for pagination
            const totalBlogPosts = await prisma.blogPost.count({
                where: {
                    report: {
                        some: {} // Only count posts with reports
                    }
                }
            });
            const totalComments = await prisma.comment.count({
                where: {
                    reports: {
                        some: {} // Only count comments with reports
                    }
                }
            });

            // Calculate total pages for each entity
            const totalBlogPages = Math.ceil(totalBlogPosts / takeLimit);
            const totalCommentPages = Math.ceil(totalComments / takeLimit);

            // Retrieve paginated blog posts with report count
            const blogPosts = await prisma.blogPost.findMany({
                where: {
                    report: {
                        some: {} // Only get posts with reports
                    }
                },
                include: {
                    report: {
                        include: {
                            reporter: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true
                                }
                            }
                        }
                    },
                    author: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                },
                orderBy: {
                    report: { _count: 'desc' }
                },
                skip,
                take: takeLimit,
            });

            // Retrieve paginated comments with report count
            const comments = await prisma.comment.findMany({
                where: {
                    reports: {
                        some: {} // Only get comments with reports
                    }
                },
                include: {
                    reports: {
                        include: {
                            reporter: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true
                                }
                            }
                        }
                    },
                    author: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                },
                orderBy: {
                    reports: { _count: 'desc' }
                },
                skip,
                take: takeLimit,
            });

            return res.status(200).json({
                blogPosts: {
                    items: blogPosts,
                    pagination: {
                        totalItems: totalBlogPosts,
                        totalPages: totalBlogPages,
                        currentPage: Number(page),
                        pageSize: takeLimit,
                    },
                },
                comments: {
                    items: comments,
                    pagination: {
                        totalItems: totalComments,
                        totalPages: totalCommentPages,
                        currentPage: Number(page),
                        pageSize: takeLimit,
                    },
                },
            });
        } catch (error) {
            console.error("Error retrieving reported content:", error);
            res.status(500).json({ error: "Error retrieving reported content" });
        }
    } else {
        res.status(405).end(`Method Not Allowed`);
    }
}

// used chatGPT to help with prisma queries
