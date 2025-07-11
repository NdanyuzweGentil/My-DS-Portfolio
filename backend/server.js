// server.js (Updated for conditional SSL)

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const { body, validationResult } = require("express-validator");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// --- PostgreSQL Database Connection ---
// Determine SSL configuration based on environment
let pgConfig = {
  connectionString: process.env.DATABASE_URL,
};

// If DATABASE_URL is present (typical for Render production) AND not running locally
// process.env.NODE_ENV is often 'production' on Render
// You can also check for a specific environment variable like RENDER
if (process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
  pgConfig.ssl = {
    rejectUnauthorized: false, // Required for Render's self-signed certs
  };
} else {
  // For local development, if DATABASE_URL is set but not for production,
  // or if connecting to a local PostgreSQL without SSL.
  // Explicitly set ssl to false or remove the property entirely.
  pgConfig.ssl = false; // Disable SSL for local development
}

const pool = new Pool(pgConfig);

// Connect to PostgreSQL and create table if it doesn't exist
pool
  .connect()
  .then((client) => {
    console.log("Connected to PostgreSQL database.");
    return client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  })
  .then(() => {
    console.log("PostgreSQL 'contacts' table ensured.");
  })
  .catch((err) => {
    console.error(
      "Error connecting to PostgreSQL or creating table:",
      err.message
    );
    // Exit process if database connection fails, as the app won't function
    process.exit(1);
  });
// --- End PostgreSQL Database Connection ---

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Contact Form API",
      version: "1.0.0",
      description: "API for submitting contact form messages",
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Development server",
      },
      {
        url: "https://your-render-app-url.onrender.com", // Replace with your actual Render URL
        description: "Production server",
      },
    ],
  },
  apis: ["./server.js"], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies
app.use(helmet()); // Apply security headers

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use("/api/contact", limiter); // Apply rate limiting to contact form submissions

// Serve Swagger UI only in development or if explicitly allowed
if (
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_SWAGGER === "true"
) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Serve static files from the 'public' directory
app.use(express.static("public"));

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Submit a contact message
 *     description: Submits a new contact message to the database after validation and sanitization.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the sender.
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 description: The email address of the sender.
 *                 example: john.doe@example.com
 *               message:
 *                 type: string
 *                 description: The contact message.
 *                 example: This is a test message.
 *     responses:
 *       200:
 *         description: Message submitted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Message submitted successfully!
 *       400:
 *         description: Invalid input or validation errors.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Validation failed.
 *                 details:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       msg:
 *                         type: string
 *                       param:
 *                         type: string
 *                       location:
 *                         type: string
 *       500:
 *         description: Server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error.
 */
app.post(
  "/api/contact",
  [
    body("name").trim().notEmpty().withMessage("Name is required").escape(),
    body("email")
      .trim()
      .isEmail()
      .withMessage("Invalid email address")
      .normalizeEmail(),
    body("message")
      .trim()
      .notEmpty()
      .withMessage("Message is required")
      .escape(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validating input:", req.body); // Log original input
      console.error("Validation errors:", errors.array());
      return res
        .status(400)
        .json({ error: "Validation failed.", details: errors.array() });
    }

    const { name, email, message } = req.body;
    const ip_address =
      req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const user_agent = req.headers["user-agent"];

    console.log("Sanitized input:", { name, email, message }); // Log sanitized input
    console.log("Received contact form data:", {
      name,
      email,
      message,
      ip_address,
      user_agent,
    });

    try {
      // --- PostgreSQL INSERT ---
      const result = await pool.query(
        "INSERT INTO contacts (name, email, message, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [name, email, message, ip_address, user_agent]
      );
      console.log(
        `New contact message from ${name} (${email}) saved with ID: ${result.rows[0].id}`
      );
      // --- End PostgreSQL INSERT ---

      res.status(200).json({ message: "Message submitted successfully!" });
    } catch (err) {
      console.error("Error saving contact message to PostgreSQL:", err.message);
      res.status(500).json({ error: "Internal server error." });
    }
  }
);

// Basic health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Service is healthy" });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access Swagger UI at http://localhost:${PORT}/api-docs`);
});
