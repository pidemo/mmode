console.log("Script running!");

// Replace with your actual Stripe Publishable Key
const STRIPE_PUBLISHABLE_KEY =
  "pk_test_51S3b0mA4ySekrCDhyT2VYq5plJpBQHvhvKfRrZpLBTgYK53SvqKY3LiJS6KNTEakc4C7rO26KzNL4yyjYwe0u4Qt008SM5Aidt";
// Replace with your Make.com Webhook URL
const MAKE_WEBHOOK_URL =
  "https://hook.us1.make.com/2n32xzpj9q5xl5h2jgy33erruv5m6tfo";

const triggers = document.querySelectorAll("[data-custom]");

triggers.forEach((trigger) => {
  trigger.addEventListener("click", async (e) => {
    e.preventDefault(); // Prevent default link behavior if it's an anchor tag
    console.log("Trigger clicked!");

    const customValue = trigger.getAttribute("data-custom");
    if (!customValue) {
      console.error("No data-custom value found");
      return;
    }

    try {
      await initializeCheckout(customValue);
    } catch (error) {
      console.error("Error initializing checkout:", error);
      alert("Something went wrong initiating the checkout.");
    }
  });
});

async function initializeCheckout(customValue) {
  // 1. Fetch the Client Secret from Make.com
  const response = await fetch(MAKE_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ customValue }),
  });

  if (!response.ok) {
    throw new Error(`Webhook call failed: ${response.statusText}`);
  }

  const data = await response.json();
  console.log("Webhook response:", data);
  const clientSecret = data.clientSecret; // Ensure your Make.com response returns this key

  if (!clientSecret) {
    throw new Error("No clientSecret returned from Make.com");
  }

  // 2. Initialize Stripe
  // Ensure Stripe.js is loaded on the page: <script src="https://js.stripe.com/v3/"></script>
  if (typeof Stripe === "undefined") {
    throw new Error("Stripe.js is not loaded");
  }

  const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

  // 3. Mount Embedded Checkout
  // We need a container. Let's create a modal overlay for a true "embedded" feel
  // or use an existing container if you prefer.
  let checkoutContainer = document.getElementById("checkout-container");

  if (!checkoutContainer) {
    // Create a simple modal overlay if container doesn't exist
    checkoutContainer = document.createElement("div");
    checkoutContainer.id = "checkout-container";
    checkoutContainer.style.position = "fixed";
    checkoutContainer.style.top = "0";
    checkoutContainer.style.left = "0";
    checkoutContainer.style.width = "100%";
    checkoutContainer.style.height = "100%";
    checkoutContainer.style.backgroundColor = "rgba(0,0,0,0.5)";
    checkoutContainer.style.zIndex = "9999";
    checkoutContainer.style.display = "flex";
    checkoutContainer.style.justifyContent = "center";
    checkoutContainer.style.alignItems = "center";

    const innerDiv = document.createElement("div");
    innerDiv.id = "checkout-embedded";
    innerDiv.style.width = "100%";
    innerDiv.style.maxWidth = "800px";
    innerDiv.style.backgroundColor = "#fff";
    innerDiv.style.padding = "20px";
    innerDiv.style.borderRadius = "8px";
    innerDiv.style.maxHeight = "90vh";
    innerDiv.style.overflowY = "auto";

    // Add close button
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.onclick = () => {
      checkout.destroy();
      document.body.removeChild(checkoutContainer);
    };
    closeBtn.style.marginBottom = "10px";

    innerDiv.appendChild(closeBtn);

    // The div Stripe will mount into
    const stripeDiv = document.createElement("div");
    stripeDiv.id = "stripe-checkout-mount";
    innerDiv.appendChild(stripeDiv);

    checkoutContainer.appendChild(innerDiv);
    document.body.appendChild(checkoutContainer);
  }

  // Initialize Embedded Checkout
  const checkout = await stripe.initEmbeddedCheckout({
    clientSecret,
  });

  // Mount Checkout
  checkout.mount("#stripe-checkout-mount");
}
