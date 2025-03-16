const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const expressLayout = require('express-ejs-layouts');
const rateLimit = require("express-rate-limit");
const passport = require('passport');
const flash = require('connect-flash');
const MemoryStore = require('memorystore')(session);
const compression = require('compression');
const ms = require('ms');
const path = require('path'); // Impor modul path (tanpa 'node:')


// --- ROUTE IMPORTS (PENTING: Sesuaikan path jika perlu) ---
const apiRouters = require('./routes/api'); // Pastikan path ke file router benar
const userRouters = require('./routes/users');
const verifyRouters = require('./routes/verify');
const premiumRouters = require('./routes/premium');

// --- MODEL, DB, AUTH, SETTINGS IMPORTS ---
const { User } = require('./models/model'); // Pastikan path ke file model benar
const { checkUsername, checkAdmin } = require('./db/db'); // Pastikan path ke file db benar
const { isAuthenticated } = require('./middleware/auth'); // Pastikan path ke file auth benar dan ini middleware
const { connectMongoDb } = require('./config/connect');  // Pastikan path ke file connect benar
const { getTotalUser, cekExpiredDays } = require('./utils/premium'); // Ganti dari 'premium' ke utils jika fungsinya ada disana.
const { port } = require('./config/settings'); // Pastikan path ke file settings benar

const app = express();
const PORT = process.env.PORT || port;

connectMongoDb();

app.set('trust proxy', 1); // Penting jika di belakang proxy (misalnya, Heroku, Nginx)
app.use(compression());    // Kompresi respons untuk kinerja lebih baik

// --- RATE LIMITING ---
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 menit
    max: 2000,             // Batasi 2000 requests per menit (sesuaikan)
    message: 'Too many requests from this IP, please try again after a minute.'
});
app.use(limiter);

// --- EJS SETUP ---
app.set('view engine', 'ejs');
app.use(expressLayout);
app.use(express.static(path.join(__dirname, 'public'))); // Gunakan path.join untuk static files

// --- SESSION SETUP ---
app.use(session({
    secret: 'secret',  // GANTI dengan secret yang lebih kuat di production!
    resave: false,      // Jangan simpan sesi jika tidak ada perubahan
    saveUninitialized: false, // Jangan simpan sesi kosong
    cookie: {
        maxAge: 86400000, // 24 jam (sesuaikan)
        secure: process.env.NODE_ENV === 'production', // Hanya gunakan secure cookies di HTTPS (production)
        httpOnly: true, // Kurangi risiko XSS
    },
    store: new MemoryStore({
        checkPeriod: 86400000 // Bersihkan sesi kadaluarsa setiap 24 jam
    }),
}));

// --- MIDDLEWARE ---
app.use(express.urlencoded({ extended: true })); // Parsing body request (form data)
app.use(express.json());                       // Parsing body request (JSON)
app.use(cookieParser());                       // Parsing cookies

// --- PASSPORT AUTH ---
app.use(passport.initialize());
app.use(passport.session());
require('./config/passport')(passport); // Asumsikan konfigurasi Passport ada di sini

// --- FLASH MESSAGES ---
app.use(flash());
app.use(function (req, res, next) {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.user || null; // Sediakan data user ke views
    next();
});

// --- ROUTES ---

app.get('/', (req, res) => {
    res.render('index', {
        layout: 'index'
    });
});

app.get('/docs', isAuthenticated, async (req, res) => {
    try {
        let userjid = await getTotalUser();
        let { apikey, username, email, totalreq } = req.user;
        res.render('docs', {
            username: username,
            apikey: apikey,
            email,
            user: userjid,
            totalreq,
            layout: 'docs'
        });
    } catch (error) {
        console.error("Error in /docs:", error); // Log error
        // Handle error dengan baik, misalnya tampilkan pesan error ke user
        res.status(500).send("Internal Server Error");
    }
});

app.get('/profile', isAuthenticated, async (req, res) => {
    try {
        let { apikey, username, limit, premium, email, totalreq, nomorWa } = req.user;
        let cekexp = ms(await cekExpiredDays(username) - Date.now());
        let expired = '0 d';
        if (cekexp !== null && cekexp !== 'NaN d') { // Tambahkan pengecekan 'NaN d'
            expired = cekexp;
        }
        res.render('profile', {
            username,
            apikey,
            limit,
            premium,
            email,
            totalreq,
            nomorWa,
            expired,
            layout: 'profile'
        });
    } catch (error) {
          console.error("Error in /profile:", error);
        res.status(500).send("Internal Server Error");
    }

});

app.post('/profile', async (req, res) => {
    try {
        let { email } = req.user;
        let { username } = req.body;
        let checkUser = await checkUsername(username);
        if (checkUser) {
            req.flash('error_msg', 'Username already exists.');
            res.redirect('/profile');
            return; // Penting: Hentikan eksekusi setelah redirect
        }
        // Gunakan await untuk operasi async
        await User.updateOne({ email: email }, { username: username });
        req.flash('success_msg', 'Successfully changed username');
        res.redirect('/profile');
    } catch (error) {
        console.error("Error in /profile POST:", error);
        req.flash('error_msg', 'Failed to change username.'); // Flash error yang lebih spesifik
        res.redirect('/profile'); // Tetap redirect ke /profile
    }
});



// --- (Sisa route handler Anda) ---
app.get('/downloader', isAuthenticated, async (req, res) => {
  let { apikey, username, email } = req.user
  res.render('downloader', {
    username: username,
    apikey: apikey,
    email,
    layout: 'downloader'
  });
});

app.get('/searching', isAuthenticated, async (req, res) => {
  let { apikey, username, email } = req.user
  res.render('searching', {
    username: username,
    apikey: apikey,
    email,
    layout: 'searching'
  });
});

app.get('/randomimage', isAuthenticated, async (req, res) => {
  let { apikey, username, email } = req.user
  res.render('randomimage', {
    username: username,
    apikey: apikey,
    email,
    layout: 'randomimage'
  });
});

app.get('/animanga', isAuthenticated, async (req, res) => {
  let { apikey, username, email } = req.user
  res.render('animanga', {
    username: username,
    apikey: apikey,
    email,
    layout: 'animanga'
  });
});

app.get('/stalking', isAuthenticated, async (req, res) => {
  let { apikey, username, email } = req.user
  res.render('stalking', {
    username: username,
    apikey: apikey,
    email,
    layout: 'stalking'
  });
});

app.get('/creator', isAuthenticated, async (req, res) => {
  let { apikey, username, email } = req.user
  res.render('creator', {
    username: username,
    apikey: apikey,
    email,
    layout: 'creator'
  });
});

app.get('/entertainment', isAuthenticated, async (req, res) => {
  let { apikey, username, email } = req.user
  res.render('entertainment', {
    username: username,
    apikey: apikey,
    email,
    layout: 'entertainment'
  });
});

app.get('/primbon', isAuthenticated, async (req, res) => {
  let { apikey, username, email } = req.user
  res.render('primbon', {
    username: username,
    apikey: apikey,
    email,
    layout: 'primbon'
  });
});

app.get('/other', isAuthenticated, async (req, res) => {
  let { apikey, username, email } = req.user
  res.render('other', {
    username: username,
    apikey: apikey,
    email,
    layout: 'other'
  });
});

app.get('/changelog', isAuthenticated, async (req, res) => {
  let { username, email } = req.user
  res.render('changelog', {
    username: username,
    email,
    layout: 'changelog'
  });
});

app.get('/pricing', isAuthenticated, async (req, res) => {
  let { username, email } = req.user
  res.render('pricing', {
       username,
       email,
       layout: 'pricing'
   })
})

app.get('/listuser', isAuthenticated, async (req, res) => {
  let { username, email } = req.user
  let List = await User.find({})
  if (username !=='wanz.') return res.redirect('/docs');
  res.render('listuser', {
       List,
       username,
       email,
       layout: 'listuser'
  })
})

app.get('/index', isAuthenticated, async(req, res) => { //hindari path ganda
  let { username, email } = req.user
  if (username !=='wanz.') return res.redirect('/docs');
  res.render('index2', { //ubah ke nama file lain, misal index2
       username,
       email,
       layout: 'index2' // sesuaikan layout
  })
})



app.use('/api', apiRouters);
app.use('/users', userRouters);
app.use('/verification', verifyRouters);
app.use('/premium', premiumRouters);

// --- 404 HANDLER (Penting: Tempatkan di akhir) ---
app.use(function (req, res, next) {
    res.status(404).render('notfound', {  // Kirim status 404
        layout: 'notfound'
    });
});

app.set('json spaces', 4); // Indentasi JSON untuk debugging

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`App listening at http://localhost:${PORT}`);
});
