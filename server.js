const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Kết nối MongoDB
mongoose.connect("mongodb+srv://duycoiomn123:duy2982002@test.8e2gj.mongodb.net/?appName=Test")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

  const dbName = 'duixs';

app.get('/api/books', async (req, res) => {
  try {
    const db = mongoose.connection.useDb(dbName);
    
    // Lấy danh sách tất cả collections (mỗi collection là 1 truyện)
    const collections = await db.db.listCollections().toArray();
    
    const books = [];
    
    for (const col of collections) {
      const collectionName = col.name;
      // Tìm doc INFO của truyện đó
      const infoDoc = await db.collection(collectionName).findOne({ _id: "INFO" });
      
      if (infoDoc) {
        books.push({
          id: collectionName, // Dùng tên collection làm ID truyện
          title: collectionName.replace(/_/g, ' '), // Tạm thời format tên
          author: infoDoc.author,
          description: infoDoc.intro,
          totalChapters: infoDoc.total_chapters || infoDoc.chapter_list?.length || 0,
          latestChapter: infoDoc.chapter_list?.slice(-1)[0]?.title || "Chưa cập nhật",
          // Bạn cần thêm field image vào INFO doc trong code Python nếu muốn hiển thị ảnh bìa
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
    const db = mongoose.connection.useDb(dbName);
    const collectionName = req.params.id;
    
    const infoDoc = await db.collection(collectionName).findOne({ _id: "INFO" });
    
    if (!infoDoc) return res.status(404).json({ message: "Truyện không tồn tại" });

    res.json(infoDoc); // Trả về toàn bộ INFO gồm chapter_list
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- API 3: Lấy nội dung chương ---
app.get('/api/books/:id/chapter/:chapId', async (req, res) => {
  try {
    const db = mongoose.connection.useDb(dbName);
    const collectionName = req.params.id;
    const chapParam = req.params.chapId;
    const chapIndex = parseInt(chapParam, 10);

    console.log(`Looking up chapter for collection="${collectionName}", chapParam="${chapParam}", parsedIndex=${chapIndex}`);

    // Try several lookup strategies to be more resilient to how data was stored:
    // 1) numeric index (number)
    // 2) numeric index as string
    // 3) match by url using INFO.chapter_list position (chapIndex-1)
    let chapterDoc = null;

    if (!isNaN(chapIndex)) {
      chapterDoc = await db.collection(collectionName).findOne({ index: chapIndex });
      if (chapterDoc) console.log('Found chapter by numeric index');
    }

    if (!chapterDoc) {
      chapterDoc = await db.collection(collectionName).findOne({ index: String(chapParam) });
      if (chapterDoc) console.log('Found chapter by string index');
    }

    if (!chapterDoc) {
      const infoDoc = await db.collection(collectionName).findOne({ _id: 'INFO' });
      if (infoDoc && Array.isArray(infoDoc.chapter_list)) {
        // Try to find chapter metadata by position in chapter_list (1-based chapId -> 0-based index)
        if (!isNaN(chapIndex)) {
          const meta = infoDoc.chapter_list[chapIndex - 1];
          if (meta && (meta.url || meta.link)) {
            const urlKey = meta.url || meta.link;
            chapterDoc = await db.collection(collectionName).findOne({ url: urlKey });
            if (chapterDoc) console.log('Found chapter by INFO.chapter_list url lookup');
          }
        }
        // As a last resort, try to find any chapter doc that has matching title or summary containing the chapParam
        if (!chapterDoc) {
          const fuzzy = await db.collection(collectionName).findOne({ $or: [ { title: { $regex: chapParam, $options: 'i' } }, { summary: { $regex: chapParam, $options: 'i' } } ] });
          if (fuzzy) {
            chapterDoc = fuzzy;
            console.log('Found chapter by fuzzy title/summary match');
          }
        }
      }
    }

    if (!chapterDoc) return res.status(404).json({ message: 'Chương không tồn tại' });

    res.json(chapterDoc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.listen(5000, () => console.log('Server running on port 5000'));