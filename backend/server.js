// server.js - Node.js Express Server with SQLite Database
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const validator = require("validator");

// --- Swagger Imports ---
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
// -----------------------

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? "https://yourdomain.com"
        : "http://localhost:3000", // Ensure this matches your frontend's origin
    credentials: true,
  })
);

// Rate limiting
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: "Too many contact form submissions, please try again later.",
  },
});

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Database setup
const db = new sqlite3.Database("./contacts.db", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
    // Handle the error appropriately, e.g., exit the process or try to recover
    process.exit(1); // Exit with an error code
  } else {
    console.log("Connected to SQLite database");

    db.run(
      `CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            ip_address TEXT,
            user_agent TEXT,
            status TEXT DEFAULT 'new'
        )`,
      (err) => {
        if (err) {
          console.error("Error creating table:", err.message);
          // Handle error, e.g., log and exit
          process.exit(1);
        } else {
          console.log("Contacts table created or already exists.");
        }
      }
    );
  }
});

// Input validation middleware
const validateContactInput = (req, res, next) => {
  const { name, email, message } = req.body;

  console.log("Validating input:", { name, email, message });

  // Check required fields
  if (!name || !email || !message) {
    console.log("Missing fields");
    return res.status(400).json({
      error: "All fields are required",
      details: {
        name: !name ? "Name is required" : null,
        email: !email ? "Email is required" : null,
        message: !message ? "Message is required" : null,
      },
    });
  }

  // Validate email format
  if (!validator.isEmail(email)) {
    console.log("Invalid email format");
    return res.status(400).json({
      error: "Invalid email format",
    });
  }

  // Validate length constraints
  if (name.length > 100) {
    console.log("Name too long");
    return res.status(400).json({
      error: "Name must be less than 100 characters",
    });
  }

  if (message.length > 1000) {
    console.log("Message too long");
    return res.status(400).json({
      error: "Message must be less than 1000 characters",
    });
  }

  // Sanitize inputs
  req.body.name = validator.escape(name.trim());
  req.body.email = validator.normalizeEmail(email);
  req.body.message = validator.escape(message.trim());

  console.log("Sanitized input:", {
    name: req.body.name,
    email: req.body.email,
    message: req.body.message,
  });

  next();
};

// --- Swagger Definition ---
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Contact Form API",
      version: "1.0.0",
      description: "API for managing contact form submissions",
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Development server",
      },
    ],
    components: {
      schemas: {
        ContactInput: {
          type: "object",
          required: ["name", "email", "message"],
          properties: {
            name: {
              type: "string",
              description: "Full name of the sender",
              example: "John Doe",
            },
            email: {
              type: "string",
              format: "email",
              description: "Email address of the sender",
              example: "john.doe@example.com",
            },
            message: {
              type: "string",
              description: "Message content",
              example: "Hello, I have a question about your service.",
            },
          },
        },
        Contact: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              description: "The auto-generated id of the contact",
              example: 1,
            },
            name: {
              type: "string",
              description: "Full name of the sender",
              example: "John Doe",
            },
            email: {
              type: "string",
              format: "email",
              description: "Email address of the sender",
              example: "john.doe@example.com",
            },
            message: {
              type: "string",
              description: "Message content",
              example: "Hello, I have a question about your service.",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "Timestamp of the submission",
              example: "2023-10-27 10:00:00",
            },
            ip_address: {
              type: "string",
              description: "IP address of the sender",
              example: "192.168.1.1",
            },
            user_agent: {
              type: "string",
              description: "User agent string of the sender's browser",
              example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            },
            status: {
              type: "string",
              enum: ["new", "read", "replied", "archived"],
              description: "Status of the contact message",
              example: "new",
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error message",
              example: "Internal server error",
            },
            details: {
              type: "object",
              description: "Optional details about the error",
            },
          },
        },
        MessageResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Contact form submitted successfully",
            },
            id: {
              type: "integer",
              example: 1,
            },
          },
        },
      },
    },
  },
  apis: ["./server.js"], // Path to the API docs (where JSDoc comments are located)
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Serve Swagger UI only in development environment
if (process.env.NODE_ENV !== "production") {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
}
// --------------------------

// API Routes

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Submit a new contact message
 *     tags: [Contacts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ContactInput'
 *     responses:
 *       201:
 *         description: Contact form submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many requests
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post("/api/contact", contactLimiter, validateContactInput, (req, res) => {
  const { name, email, message } = req.body;
  const ip_address = req.ip || req.connection.remoteAddress;
  const user_agent = req.get("User-Agent");

  console.log("Received contact form data:", {
    name,
    email,
    message,
    ip_address,
    user_agent,
  });

  // Insert into database
  const sql = `INSERT INTO contacts (name, email, message, ip_address, user_agent) 
                 VALUES (?, ?, ?, ?, ?)`;

  db.run(sql, [name, email, message, ip_address, user_agent], function (err) {
    if (err) {
      console.error("Database error:", err.message);
      console.error("Stack trace:", err.stack);
      return res.status(500).json({
        error: "Failed to submit message. Please try again later.",
      });
    }

    console.log(`New contact message from ${name} (${email})`);

    // Optional: Send email notification here
    // sendEmailNotification(name, email, message);

    res.status(201).json({
      message: "Contact form submitted successfully",
      id: this.lastID,
    });
  });
});

/**
 * @swagger
 * /api/contacts:
 *   get:
 *     summary: Retrieve a list of all contact messages
 *     tags: [Contacts]
 *     description: (Admin endpoint) Retrieves all contact messages, ordered by timestamp descending.
 *     responses:
 *       200:
 *         description: A list of contact messages.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 contacts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Contact'
 *                 total:
 *                   type: integer
 *                   example: 1
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/api/contacts", (req, res) => {
  const sql = `SELECT * FROM contacts ORDER BY timestamp DESC`;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({
        error: "Internal server error",
      });
    }

    res.json({
      contacts: rows,
      total: rows.length,
    });
  });
});

/**
 * @swagger
 * /api/contacts/{id}:
 *   get:
 *     summary: Retrieve a single contact message by ID
 *     tags: [Contacts]
 *     description: (Admin endpoint) Retrieves a specific contact message using its ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Numeric ID of the contact to retrieve.
 *     responses:
 *       200:
 *         description: A single contact message.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contact'
 *       404:
 *         description: Contact not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/api/contacts/:id", (req, res) => {
  const sql = `SELECT * FROM contacts WHERE id = ?`;

  db.get(sql, [req.params.id], (err, row) => {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({
        error: "Internal server error",
      });
    }

    if (!row) {
      return res.status(404).json({
        error: "Contact not found",
      });
    }

    res.json(row);
  });
});

/**
 * @swagger
 * /api/contacts/{id}/status:
 *   patch:
 *     summary: Update the status of a contact message
 *     tags: [Contacts]
 *     description: (Admin endpoint) Updates the status of a specific contact message.
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Numeric ID of the contact to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: ["new", "read", "replied", "archived"]
 *                 description: The new status for the contact message.
 *                 example: "read"
 *     responses:
 *       200:
 *         description: Status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Status updated successfully"
 *       400:
 *         description: Invalid status provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Contact not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.patch("/api/contacts/:id/status", (req, res) => {
  const { status } = req.body;
  const validStatuses = ["new", "read", "replied", "archived"];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: "Invalid status. Must be one of: " + validStatuses.join(", "),
    });
  }

  const sql = `UPDATE contacts SET status = ? WHERE id = ?`;

  db.run(sql, [status, req.params.id], function (err) {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({
        error: "Internal server error",
      });
    }

    if (this.changes === 0) {
      return res.status(404).json({
        error: "Contact not found",
      });
    }

    res.json({
      message: "Status updated successfully",
    });
  });
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     description: Checks the health and uptime of the API server.
 *     responses:
 *       200:
 *         description: Server is healthy.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 *                 timestamp:
 *                   type: string
 *                   format: "date-time"
 *                   example: "2023-10-27T10:00:00.000Z"
 *                 uptime:
 *                   type: number
 *                   example: 3600
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Received SIGINT. Graceful shutdown...");
  db.close((err) => {
    if (err) {
      console.error("Error closing database:", err.message);
    } else {
      console.log("Database connection closed");
    }
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
