console.log("Script running locally latest!");

// Determine mode based on domain
const isTestMode = window.location.hostname.includes("webflow.io");
const mode = isTestMode ? "test" : "live";
console.log(`Running in ${mode} mode`);

// Define keys
const STRIPE_TEST_KEY = "pk_test_7DoZiEh5gsTdhGuh2a5Rf0Px"; // MMode Test Key
const STRIPE_LIVE_KEY = "pk_live_PLACEHOLDER_KEY"; // Replace with your actual Live Key

const STRIPE_PUBLISHABLE_KEY = isTestMode ? STRIPE_TEST_KEY : STRIPE_LIVE_KEY;

const MAKE_WEBHOOK_URL =
  "https://hook.us1.make.com/2n32xzpj9q5xl5h2jgy33erruv5m6tfo";

const triggers = document.querySelectorAll("[data-target]");

triggers.forEach((trigger) => {
  trigger.addEventListener("click", async (e) => {
    e.preventDefault(); // Prevent default link behavior if it's an anchor tag
    console.log("Trigger clicked!");

    const customValue = trigger.getAttribute("data-target");
    if (!customValue) {
      console.error("No data-target value found");
      return;
    }

    try {
      //console.log("Target value:", customValue);
      await initializeCheckout(customValue);
    } catch (error) {
      console.error("Error initializing checkout:", error);
      alert("Something went wrong initiating the checkout.");
    }
  });
});

async function initializeCheckout(customValue) {
  // 0. Get Memberstack Member ID
  let memberMSID = null;
  let memberSCID = null;
  let memberATID = null;
  let memberWFID = null;
  if (window.$memberstackDom) {
    try {
      const { data: member } = await window.$memberstackDom.getCurrentMember();
      memberMSID = member ? member.id : null;
      memberSCID =
        member && member.customFields ? member.customFields["item-scid"] : null;
      memberATID =
        member && member.customFields ? member.customFields["item-atid"] : null;
      memberWFID =
        member && member.customFields ? member.customFields["item-id"] : null;
    } catch (err) {
      console.warn("Error fetching Memberstack member:", err);
    }
  }

  if (!memberMSID || !memberSCID || !memberATID || !memberWFID) {
    console.warn(
      `Missing a parameter: ${
        !memberMSID
          ? "memberMSID"
          : !memberSCID
          ? "memberSCID"
          : !memberATID
          ? "memberATID"
          : "memberWFID"
      }. Proceeding without it.`
    );
  }

  // 1. Fetch the Client Secret from Make.com
  const response = await fetch(MAKE_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      targetValue: customValue,
      memberMSID,
      memberSCID,
      memberATID,
      memberWFID,
      mode,
    }),
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
  // Ensure Stripe.js is loaded on the page
  if (typeof Stripe === "undefined") {
    throw new Error("Stripe.js is not loaded");
  }

  const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

  // 3. Mount Embedded Checkout
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
    closeBtn.textContent = "✕"; // Multiply sign (cross)
    closeBtn.style.background = "none";
    closeBtn.style.backgroundColor = "transparent";
    closeBtn.style.border = "none";
    closeBtn.style.borderRadius = "50%";
    closeBtn.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.12)";
    closeBtn.style.width = "36px";
    closeBtn.style.height = "36px";
    closeBtn.style.display = "flex";
    closeBtn.style.alignItems = "center";
    closeBtn.style.justifyContent = "center";
    closeBtn.style.fontSize = "20px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.marginBottom = "10px";

    closeBtn.onclick = () => {
      checkout.destroy();
      document.body.removeChild(checkoutContainer);
    };

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
