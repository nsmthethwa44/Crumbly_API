import express from "express";
import mysql from "mysql";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import dotenv from "dotenv";
dotenv.config(); // Load .env variables

const app = express();
app.use(cookieParser());

app.use(
  cors({
    origin: ["https://crumblysite.netlify.app/"],
    credentials: true,
    methods: ["POST", "GET", "PUT", "DELETE"],
  })
);

app.use(express.json());
app.use(express.static("public"));

// Configure connection pool
const pool = mysql.createPool({
  connectionLimit: 5, // Adjust the limit as per your needs
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectTimeout: 30000,  // Increase timeout to 30 seconds
  timeout: 30000          // Set connection timeout
});

// Helper function to query using the connection pool
const query = (sql, values = []) =>
  new Promise((resolve, reject) => {
    pool.query(sql, values, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "./public/images");
    },
    filename: (req, file, cb) => {
      cb(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname));
    },
  });
  
  const upload = multer({
    storage: storage,
  });



// start  manage  cakes 
   // fetching cakes category or userId 
   app.get("/getCakes/:category", async (req, res) => {
    const { category } = req.params;
    if (!category) {
      return res.status(400).json({ success: false, message: "Category is required" });
    }
    try {
      // Query to fetch movies with or without user_id
      const sql = `SELECT * FROM cakes WHERE category = ?`;
      const results = await query(sql, [category])
        return res.json({ success: true, Result: results });
    } catch (error) {
      console.error("Error fetching cakes:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

// get all cakes based userId 
app.get("/getCakes/:user_id?", async (req, res) => {
  const {user_id } = req.params;
  try {
      let sql = `
    SELECT 
      c.id, 
      c.title, 
      c.image, 
      c.category,
      c.price,
      CASE 
        WHEN l.user_id IS NOT NULL THEN 1 
        ELSE 0 
      END AS liked
    FROM cakes c
    LEFT JOIN favorites l 
      ON c.id = l.cake_id AND l.user_id = ?
  `;
  const params = user_id ? [user_id] : [null];
  const results = await query(sql, params)
    res.json({ success: true, Result: results });
  } catch (error) {
      console.error("Unexpected error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// app.get("/getCakes", async (req, res) => {
//   try {
//     // Query to fetch movies with or without user_id
//     const sql = `SELECT * FROM cakes`;
//     const results = await query(sql)
//       return res.json({ success: true, Result: results });
//   } catch (error) {
//     console.error("Error fetching cakes:", error);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// });

  // fetching movies with genre or userId 
app.get("/getCakes/:category/:user_id?", async (req, res) => {
  const { category, user_id } = req.params;
  if (!category) {
    return res.status(400).json({ success: false, message: "Category is required" });
  }
  try {
    // Query to fetch movies with or without user_id
    const sql = `
      SELECT 
        c.id, 
        c.title, 
        c.image, 
        c.category,
        c.price,
        CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END AS liked
      FROM cakes c
      LEFT JOIN favorites f
        ON c.id = f.cake_id AND f.user_id = ?
      WHERE c.category = ?
    `;

    const queryParams = [user_id || null, category]; // Use null if user_id is not provided
    const results = await query(sql, queryParams)
      return res.json({ success: true, Result: results });
  } catch (error) {
    console.error("Error fetching cakes:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});



    // app.get("/getCakes", async (req, res) =>{
//   try {
//     const sql = "Select * From cakes";
//     const results = await query(sql);
//     res.status(200).json({ Status: "Success", Result: results });
//   } catch (error) {
//     console.error("Unexpected error:", error);
//       res.status(500).json({ error: "Internal server error" });
//   }
// });

//   add favorites menus 
app.post("/toggleFavorites", async (req, res) => {
    const { cake_id, user_id } = req.body;
    try {
      const sql = "SELECT * FROM favorites WHERE cake_id = ? AND user_id = ?";
      const results = await query(sql, [cake_id, user_id])
        if (results.length > 0) {
          const deleteSql = "DELETE FROM favorites WHERE id = ?";
          await query(deleteSql, [results[0].id])
          res.json({ success: true, liked: false });
        } else {
          const insertSql = "INSERT INTO favorites (cake_id, user_id) VALUES (?, ?)";
          await query(insertSql, [cake_id, user_id])
            res.json({ success: true, liked: true });
        };
    } catch (error) {
      console.error("Error toggling like:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });



  // Fetch count user total likes for a movies
app.get('/userFavorites/:id', async  (req, res) => {
    const { id: userId } = req.params;
    try {
      const sql = `SELECT COUNT(*) AS likes FROM favorites WHERE user_id = ?`;
      const results =  await query(sql, [userId])
      res.json({ Status: "Success", Result: results });
    } catch (error) {
        console.error("Error getting favorites count:", error);
    }
  });

  // count user cart 
  app.get('/userCartCount/:id', async  (req, res) => {
    const { id: userId } = req.params;
    try {
      const sql = `SELECT COUNT(*) AS cart FROM cart WHERE user_id = ?`;
      const results = await query(sql, [userId]);
      res.json({ Status: "Success", Result: results });
    } catch (error) {
      console.error("Error getting cart count:", error);
    }
  })

//   adding  cakes on a cart 
  app.post('/addingToCart', async (req, res) => {
    const { user_id, cake_id } = req.body;
    try {
        if (!user_id || !cake_id) {
            return res.status(400).json({ error: 'User ID and Cake ID are required' });
        }
        const checkSql = `SELECT * FROM cart WHERE user_id = ? AND cake_id = ?`;
        const results = await query(checkSql, [user_id, cake_id]);
         if (results.length > 0) {
            return res.status(400).json({ message: 'Cake is already in your cart' });
        } else {
        const insertSql = `INSERT INTO cart (user_id, cake_id) VALUES (?, ?)`;
        await query(insertSql, [user_id, cake_id]);
        return res.status(200).json({ message: 'Cake added to your cart' });
    }
    } catch (error) {
      console.error("Error adding to cart:", error.message);
        res.status(500).json({ error: 'Database query error' });
    };
  });

      // API to get favorite cakes by a specific user
app.get("/getMyFavoritesCakes/:user_id", async (req, res) => {
  const { user_id } = req.params;
  try {
    const sql = `
    SELECT c.id, c.title, c.price, c.image
    FROM cakes c
    JOIN favorites f ON c.id = f.cake_id
    WHERE f.user_id = ?;
  `;
  const results = await query(sql, [user_id])
    res.json({ success: true, Result: results });
  } catch (error) {
    console.error("Error fetching favorites menus:", err);
  }
});

      // API to get cart cakes by a specific user
      app.get("/getCartCakes/:user_id", async (req, res) => {
        const { user_id } = req.params;
        try {
          const sql = `
          SELECT c.id, c.title, c.price, c.image
          FROM cakes c
          JOIN cart f ON c.id = f.cake_id
          WHERE f.user_id = ?;
        `;
        const results = await query(sql, [user_id])
          res.json({ success: true, Result: results });
        } catch (error) {
          console.error("Error fetching cart cakes:", err);
        }
      });
// end manage cakes 

// API to delete a liked menu
app.delete("/deleteMyFavoritesCake/:cake_id/:user_id", async (req, res) => {
  const { cake_id, user_id } = req.params;
  try {
    const sql = "DELETE FROM favorites WHERE cake_id = ? AND user_id = ?";
    const results = await query(sql, [cake_id, user_id])
    if (results.affectedRows > 0) {
      res.json({ success: true, message: "Cake successfully removed from my favorites." });
    } else {
      res.status(404).json({ success: false, message: "Like not found." });
    }
  } catch (error) {
    console.error("Error deleting favorite menu:", error);
  }
});

// API to delete a liked menu
app.delete("/deleteCartCake/:cake_id/:user_id", async (req, res) => {
  const { cake_id, user_id } = req.params;
  try {
    const sql = "DELETE FROM cart WHERE cake_id = ? AND user_id = ?";
    const results = await query(sql, [cake_id, user_id])
    if (results.affectedRows > 0) {
      res.json({ success: true, message: "Cake successfully removed from my cart." });
    } else {
      res.status(404).json({ success: false, message: "Like not found." });
    }
  } catch (error) {
    console.error("Error deleting favorite menu:", error);
  }
});


// manage users 

// adding new users 
const saltRounds = 10;

app.post("/registerUser", upload.single("photo"), async (req, res) => {
  const { name, email, password } = req.body;
  const photo = req.file?.filename || null;
  try {
    const existingUser = await query("SELECT * FROM users WHERE email = ?", [email]);
    if (existingUser.length > 0) {
      return res.status(409).json({
        Status: "Exists",
        message: "User already exists. Please log in.",
      });
    }
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const sql =
      "INSERT INTO users (`name`, `email`, `password`, `photo`) VALUES (?)";
    const values = [name, email, hashedPassword, photo];
    await query(sql, [values]);
    res.json({ Status: "Success", message: "User successfully registered!" });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "An error occurred while adding the user." });
  }
});

// user login
app.post("/userLogin", async (req, res) => {
    const { email, password } = req.body;
    try {
      const users = await query("SELECT * FROM users WHERE email = ?", [email]);
      if (users.length === 0) {
        return res
          .status(401)
          .json({ Status: "Error", message: "User not found. Please register." });
      }
      const user = users[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ Status: "Error", message: "Incorrect password." });
      }
      const token = jwt.sign(
        { id: user.id, name: user.name, email: user.email, photo: user.photo },
        "jwt-secret-key",
        { expiresIn: "1d" }
      );
      res.cookie("token", token);
      res.json({
        Status: "Success",
        message: "Login successful!",
        token,
        user: { id: user.id, name: user.name, email: user.email, photo: user.photo },
      });
    } catch (err) {
      console.error("Error logging in user:", err);
      res.status(500).json({ error: "An error occurred during login." });
    }
  });

// end manage users 

// user logout 
app.get("/logout", (req, res) =>{
    res.clearCookie("token");
    return res.json({Status: "Success", message: "Logged out successfully!"});
  })
// end user logout 

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
