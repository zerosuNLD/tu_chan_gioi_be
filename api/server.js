const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Kết nối MongoDB - Sử dụng biến môi trường MONGODB_URI để bảo mật
const mongoURI = process.env.MONGODB_URI || "mongodb+srv://duycoiomn123:duy2982002@test.8e2gj.mongodb.net/?appName=Test";
const dbName = 'duixs';

// Cache kết nối để tăng tốc độ Serverless
let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) return cachedDb;
    await mongoose.connect(mongoURI);
    cachedDb = mongoose.connection;
    return cachedDb;
}

// --- API 1: Lấy danh sách truyện ---
app.get('/api/books', async (req, res) => {
    try {
        await connectToDatabase();
        const db = mongoose.connection.useDb(dbName);
        const collections = await db.db.listCollections().toArray();
        const books = [];

        for (const col of collections) {
            const collectionName = col.name;
            const infoDoc = await db.collection(collectionName).findOne({ _id: "INFO" });
            if (infoDoc) {
                books.push({
                    id: collectionName,
                    title: collectionName.replace(/_/g, ' '),
                    author: infoDoc.author,
                    description: infoDoc.intro,
                    totalChapters: infoDoc.total_chapters || infoDoc.chapter_list?.length || 0,
                    latestChapter: infoDoc.chapter_list?.slice(-1)[0]?.title || "Chưa cập nhật",
                    image: infoDoc.image || "https://via.placeholder.com/150",
                });
            }
        }
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- API 2: Lấy chi tiết truyện & Mục lục ---
app.get('/api/books/:id', async (req, res) => {
    try {
        await connectToDatabase();
        const db = mongoose.connection.useDb(dbName);
        const infoDoc = await db.collection(req.params.id).findOne({ _id: "INFO" });
        if (!infoDoc) return res.status(404).json({ message: "Truyện không tồn tại" });
        res.json(infoDoc);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- API 3: Lấy nội dung chương ---
app.get('/api/books/:id/chapter/:chapId', async (req, res) => {
    try {
        await connectToDatabase();
        const db = mongoose.connection.useDb(dbName);
        const { id: collectionName, chapId: chapParam } = req.params;
        const chapIndex = parseInt(chapParam, 10);

        let chapterDoc = null;

        // Tìm theo index số
        if (!isNaN(chapIndex)) {
            chapterDoc = await db.collection(collectionName).findOne({ index: chapIndex });
        }
        // Tìm theo index chuỗi
        if (!chapterDoc) {
            chapterDoc = await db.collection(collectionName).findOne({ index: String(chapParam) });
        }
        // Tìm theo vị trí trong chapter_list
        if (!chapterDoc) {
            const infoDoc = await db.collection(collectionName).findOne({ _id: 'INFO' });
            if (infoDoc?.chapter_list && !isNaN(chapIndex)) {
                const meta = infoDoc.chapter_list[chapIndex - 1];
                if (meta) {
                    const urlKey = meta.url || meta.link;
                    chapterDoc = await db.collection(collectionName).findOne({ url: urlKey });
                }
            }
        }

        if (!chapterDoc) return res.status(404).json({ message: 'Chương không tồn tại' });
        res.json(chapterDoc);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Xuất app để Vercel sử dụng thay vì app.listen
module.exports = app;