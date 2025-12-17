// Determine mode based on domain
const isTestMode = window.location.hostname.includes("webflow.io");
const mode = isTestMode ? "test" : "live";
console.log(`Running in ${mode} mode`);

// Define keys
const STRIPE_TEST_KEY = "pk_test_7DoZiEh5gsTdhGuh2a5Rf0Px"; // MMode Test Key
const STRIPE_LIVE_KEY = "pk_live_0pracU44dFLTaSJuMzPT3I47"; // Replace with your actual Live Key

const STRIPE_PUBLISHABLE_KEY = isTestMode ? STRIPE_TEST_KEY : STRIPE_LIVE_KEY;

const MAKE_WEBHOOK_URL =
  "https://hook.us1.make.com/2n32xzpj9q5xl5h2jgy33erruv5m6tfo";

const triggers = document.querySelectorAll("[data-target]");

triggers.forEach((trigger) => {
  trigger.addEventListener("click", async (e) => {
    e.preventDefault(); // Prevent default link behavior if it's an anchor tag

    const customValue = trigger.getAttribute("data-target");
    if (!customValue) {
      console.error("No data-target value found");
      return;
    }

    // Store original content and show spinner
    const originalContent = trigger.innerHTML;
    const originalWidth = trigger.offsetWidth; // Keep width to prevent jumping
    trigger.style.width = `${originalWidth}px`;
    trigger.style.display = "inline-flex"; // Ensure centering
    trigger.style.justifyContent = "center";
    trigger.style.alignItems = "center";
    trigger.innerHTML = `<div class="loader"></div>`;
    trigger.disabled = true; // Prevent double clicks

    // Inject spinner CSS if not already present
    if (!document.getElementById("spinner-style")) {
      const style = document.createElement("style");
      style.id = "spinner-style";
      style.textContent = `
        .loader {
          border: 2px solid #f3f3f3;
          border-top: 2px solid #333;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .checkout-error-message {
          color: #dc3545;
          margin-top: 8px;
          font-size: 14px;
          font-weight: 500;
        }
      `;
      document.head.appendChild(style);
    }

    // Remove existing error message if present
    const existingError = trigger.nextElementSibling;
    if (
      existingError &&
      existingError.classList.contains("checkout-error-message")
    ) {
      existingError.remove();
    }

    try {
      await initializeCheckout(customValue);
    } catch (error) {
      console.error("Error initializing checkout:", error);

      // Create and display error message
      const errorDiv = document.createElement("div");
      errorDiv.className = "checkout-error-message";

      // Sanitize error message
      let simpleError = error.message.replace("Webhook call failed: ", "");

      // Check for forbidden terms
      const forbiddenTerms = [
        /make\.com/i,
        /memberstack/i,
        /webflow/i,
        /webhook/i,
      ];
      const hasForbiddenTerm = forbiddenTerms.some((term) =>
        term.test(simpleError)
      );

      if (hasForbiddenTerm) {
        // Check for specific missing parameters to add context
        let extraContext = "";
        if (simpleError.includes("memberMSID"))
          extraContext = " (missing MSID)";
        else if (simpleError.includes("memberSCID"))
          extraContext = " (missing SCID)";
        else if (simpleError.includes("memberATID"))
          extraContext = " (missing ATID)";
        else if (simpleError.includes("memberWFID"))
          extraContext = " (missing WFID)";
        else if (simpleError.includes("memberEmail"))
          extraContext = " (missing Email)";

        simpleError = "Configuration error" + extraContext;
      }

      errorDiv.textContent = `Error: ${simpleError}. Please try again later, and contact us if the issue persists.`;

      trigger.insertAdjacentElement("afterend", errorDiv);
    } finally {
      // Restore button state
      trigger.innerHTML = originalContent;
      trigger.disabled = false;
      trigger.style.width = ""; // Reset width
    }
  });
});

async function initializeCheckout(customValue) {
  // 0. Get Memberstack Member ID
  let memberMSID = null;
  let memberSCID = null;
  let memberATID = null;
  let memberWFID = null;
  let memberEmail = null;

  if (window.$memberstackDom) {
    try {
      const { data: member } = await window.$memberstackDom.getCurrentMember();
      memberMSID = member ? member.id : null;
      memberEmail = member ? member.auth.email : null;
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

  if (
    !memberMSID ||
    !memberSCID ||
    !memberATID ||
    !memberWFID ||
    !memberEmail
  ) {
    const missingParams = [];
    if (!memberMSID) missingParams.push("MSID");
    if (!memberSCID) missingParams.push("SCID");
    if (!memberATID) missingParams.push("ATID");
    if (!memberWFID) missingParams.push("WFID");
    if (!memberEmail) missingParams.push("Email");

    console.error(`Missing parameters: ${missingParams.join(", ")}`);
    alert(
      `Missing user information (${missingParams.join(
        ", "
      )}). Please refresh the page and try again.`
    );
    return;
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
      memberEmail,
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

// Reload Memberstack data on page load
window.addEventListener("load", function () {
  setTimeout(function () {
    // Try Memberstack 2.0 (detected in this codebase)
    if (window.$memberstackDom) {
      window.$memberstackDom.getCurrentMember().then(() => {
        console.log("Memberstack (2.0) data refreshed.");
      });
    } else {
      console.log("MemberStack SDK not detected.");
    }
  }, 500);
});
