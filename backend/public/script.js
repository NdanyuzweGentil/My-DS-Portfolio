// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    document.querySelector(this.getAttribute("href")).scrollIntoView({
      behavior: "smooth",
    });
  });
});

// Animate sections on scroll using IntersectionObserver
const observerOptions = {
  threshold: 0.1, // Trigger when 10% of the element is visible
  rootMargin: "0px 0px -100px 0px", // Reduce bottom margin of root for earlier trigger
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("animate");
      console.log(
        `IntersectionObserver: Section "${entry.target.id}" is now animating.`
      ); // Debug log
      // Optionally, unobserve once animated if you only want it to animate once
      // observer.unobserve(entry.target);
    } else {
      // Optional: remove 'animate' class if you want the animation to reset when scrolling out of view
      // entry.target.classList.remove("animate");
    }
  });
}, observerOptions);

document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll(".section");
  console.log(
    `DOMContentLoaded: Found ${sections.length} sections to observe.`
  ); // Debug log
  if (sections.length === 0) {
    console.warn(
      "DOMContentLoaded: No elements with class 'section' found. Animation may not work."
    );
  }
  sections.forEach((section) => {
    observer.observe(section);
  });

  // Add loading animation for body opacity
  document.body.style.opacity = "0";
  setTimeout(() => {
    document.body.style.transition = "opacity 0.5s ease";
    document.body.style.opacity = "1";
  }, 100);

  // Initialize progress bars data (no visual effect from this function call)
  createProgressBars(); // Call this here if it has other side effects
});

// Header scroll effect
window.addEventListener("scroll", () => {
  const header = document.querySelector("header");
  if (window.scrollY > 100) {
    header.style.background = "rgba(15, 15, 35, 0.98)";
    header.style.boxShadow = "0 2px 20px rgba(0, 247, 255, 0.2)";
  } else {
    header.style.background = "rgba(15, 15, 35, 0.95)";
    header.style.boxShadow = "none";
  }
});

// Form submission with backend integration
document
  .querySelector(".contact-form")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      message: formData.get("message"),
      // timestamp is generated on the server side, no need to send from client
    };

    try {
      // Show loading state
      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "Sending...";
      submitBtn.disabled = true;

      // Send to backend API
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        // Success feedback
        submitBtn.textContent = "Message Sent! ✓";
        submitBtn.style.background =
          "linear-gradient(135deg, #10b981, #059669)";
        this.reset();

        // Show success message
        showNotification(
          "Thank you for your message! I'll get back to you soon.",
          "success"
        );
      } else {
        // Parse error response from server if available
        const errorData = await response.json();
        throw new Error(errorData.error || "Network response was not ok");
      }
    } catch (error) {
      console.error("Error:", error);
      showNotification(
        `Error: ${
          error.message ||
          "Sorry, there was an error sending your message. Please try again."
        }`,
        "error"
      );
    } finally {
      // Reset button after 3 seconds
      setTimeout(() => {
        const submitBtn = this.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.textContent = originalText;
          submitBtn.style.background =
            "linear-gradient(135deg, #00f7ff, #ff0080)";
          submitBtn.disabled = false;
        }
      }, 3000);
    }
  });

// Notification system
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.textContent = message;

  notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 10px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        `;

  if (type === "success") {
    notification.style.background = "linear-gradient(135deg, #10b981, #059669)";
  } else if (type === "error") {
    notification.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
  } else {
    notification.style.background = "linear-gradient(135deg, #3b82f6, #1d4ed8)";
  }

  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.style.transform = "translateX(0)";
  }, 100);

  // Remove after 5 seconds
  setTimeout(() => {
    notification.style.transform = "translateX(100%)";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 5000);
}

// Animated metrics counter
function animateMetrics() {
  const metrics = document.querySelectorAll(".metric-value");
  metrics.forEach((metric) => {
    const target = parseFloat(metric.textContent);
    const isPercentage = metric.textContent.includes("%");
    const isLarge = metric.textContent.includes("M");

    let current = 0;
    const duration = 1500; // milliseconds for animation
    let startTime = null;

    function step(currentTime) {
      if (!startTime) startTime = currentTime;
      const progress = (currentTime - startTime) / duration;

      if (progress < 1) {
        let value = current + (target - current) * progress; // Linear interpolation
        if (isPercentage) {
          metric.textContent = Math.floor(value) + "%";
        } else if (isLarge) {
          metric.textContent = value.toFixed(1) + "M";
        } else {
          metric.textContent = Math.floor(value) + "+";
        }
        requestAnimationFrame(step);
      } else {
        // Ensure final value is exact
        if (isPercentage) {
          metric.textContent = Math.floor(target) + "%";
        } else if (isLarge) {
          metric.textContent = target.toFixed(1) + "M";
        } else {
          metric.textContent = Math.floor(target) + "+";
        }
      }
    }
    requestAnimationFrame(step);
  });
}

// Trigger metrics animation when hero section is visible
const heroObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateMetrics();
        heroObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.5 }
);

heroObserver.observe(document.querySelector(".hero"));

// Parallax effect for hero background
window.addEventListener("scroll", () => {
  const scrolled = window.pageYOffset;
  const hero = document.querySelector(".hero");
  if (hero) {
    // Adjust the multiplier for desired parallax speed
    hero.style.transform = `translateY(${scrolled * 0.2}px)`;
  }
});

// Typing effect for hero title
function typeWriter(element, text, delay = 100) {
  element.textContent = "";
  let i = 0;
  const timer = setInterval(() => {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
    } else {
      clearInterval(timer);
    }
  }, delay);
}

// Initialize typing effect after page load
window.addEventListener("load", () => {
  setTimeout(() => {
    const heroTitle = document.querySelector(".hero-text h1");
    if (heroTitle) {
      typeWriter(heroTitle, "Data Scientist", 70); // Adjusted delay for faster typing
    }
  }, 500); // Reduced initial delay
});

// Add mouse move effect to project cards
document.querySelectorAll(".project-card").forEach((card) => {
  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = card.getBoundingClientRect().height / 2; // Use current height

    // Adjust rotation intensity
    const rotateX = (y - centerY) / 20;
    const rotateY = (centerX - x) / 20;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`; // Slightly less translateY
  });

  card.addEventListener("mouseleave", () => {
    card.style.transform =
      "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)";
  });
});

// Add floating animation to skill icons
document.querySelectorAll(".skill-icon").forEach((icon, index) => {
  icon.style.animation = `float 3s ease-in-out infinite ${index * 0.2}s`; // Adjusted delay for more distinct animation
});

// Progress bar animation for skills (this function is not used to render anything)
function createProgressBars() {
  const skills = [
    { name: "Python", level: 95 },
    { name: "Machine Learning", level: 90 },
    { name: "SQL", level: 85 },
    { name: "R", level: 80 },
    { name: "Tableau", level: 88 },
    { name: "Statistics", level: 92 },
  ];
  return skills;
}

// Add keyboard navigation
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    // Close any open modals or reset focus
    document.activeElement.blur();
  }
});

// Add smooth scroll to top functionality (button not present in HTML)
const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// Show/hide scroll to top button (button not present in HTML)
window.addEventListener("scroll", () => {
  const scrollButton = document.querySelector(".scroll-to-top");
  if (scrollButton) {
    if (window.scrollY > 300) {
      scrollButton.classList.add("visible");
    } else {
      scrollButton.classList.remove("visible");
    }
  }
});
