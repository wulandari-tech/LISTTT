require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path'); // Memperbaiki pemanggilan modul path
// const fs = require('fs'); // fs tidak lagi dibutuhkan untuk photos.json
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;

// --- PENYIMPANAN DATA DI MEMORI SERVER ---
let photosDataStore = []; // Array untuk menyimpan metadata foto di memori

// Konfigurasi Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

// Konfigurasi Multer untuk penyimpanan sementara di memori
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype) {
            return cb(null, true);
        }
        cb(new Error("Error: Hanya file gambar yang diizinkan (jpeg, jpg, png, gif, webp)!"));
    },
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// --- RUTE API ---

// Rute untuk upload foto
app.post('/api/upload', upload.single('imageFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Tidak ada file yang diupload atau tipe file tidak valid.' });
    }
    if (!req.body.imageCaption) {
        return res.status(400).json({ message: 'Caption tidak boleh kosong.' });
    }

    try {
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

        const cloudinaryUploadResult = await cloudinary.uploader.upload(dataURI, {
            // Opsi Cloudinary bisa ditambahkan di sini jika perlu
            // folder: "album_wulan_app_memory", 
        });

        console.log("Cloudinary Upload Result:", cloudinaryUploadResult);

        const newPhoto = {
            id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            src: cloudinaryUploadResult.secure_url,
            alt: req.body.imageCaption.substring(0, 70) || 'Foto dari album',
            caption: req.body.imageCaption,
            public_id: cloudinaryUploadResult.public_id,
            width: cloudinaryUploadResult.width,
            height: cloudinaryUploadResult.height,
            format: cloudinaryUploadResult.format,
        };

        photosDataStore.unshift(newPhoto); // Tambahkan ke array di memori
        console.log(`Foto ditambahkan ke memori. Total foto sekarang: ${photosDataStore.length}`);

        res.status(201).json({ message: 'Foto berhasil diupload ke Cloudinary dan data disimpan di memori!', photo: newPhoto });

    } catch (error) {
        console.error('Error uploading to Cloudinary or processing:', error);
        let errorMessage = 'Gagal mengupload foto.';
        if (error.message && error.message.includes("File size too large")) {
            errorMessage = "Ukuran file terlalu besar.";
        } else if (error.http_code === 401 || error.http_code === 403) {
            errorMessage = "Autentikasi Cloudinary gagal. Periksa API credentials.";
        }
        res.status(500).json({ message: errorMessage, error: error.message });
    }
});

// Rute untuk mendapatkan semua foto
app.get('/api/photos', (req, res) => {
    // Kembalikan data langsung dari array di memori
    console.log(`Mengirim ${photosDataStore.length} foto dari memori.`);
    res.json(photosDataStore);
});


// --- RUTE HALAMAN ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});


app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
    console.log("Penyimpanan data foto menggunakan array di memori (data akan hilang saat server restart).");
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        console.warn("\x1b[33m%s\x1b[0m", "PERINGATAN: Variabel lingkungan Cloudinary belum diatur. Upload ke Cloudinary akan gagal.");
    } else {
        console.log("Cloudinary dikonfigurasi untuk cloud:", process.env.CLOUDINARY_CLOUD_NAME);
    }
});