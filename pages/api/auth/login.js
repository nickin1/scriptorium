import { PrismaClient } from "@prisma/client";
import bcrypt from 'bcrypt'
import { generateToken } from "../../../lib/auth";

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed.' })
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Missing email or password' })
    }

    try {

        const user = await prisma.user.findUnique({
            where: {
                email: email
            }
        });

        if (!user) {
            return res.status(401).json({ messsage: 'Invalid email or password' })
        }

        if (!await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = generateToken(user);

        res.status(200).json({
            message: 'Logged in successfully',
            token
        })

    } catch (error) {
        console.error('/api/auth/login error: ', error);
        res.status(500).json({ error: 'Internal server error' })
    }
}