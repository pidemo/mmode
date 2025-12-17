// Wait for the page to be fully loaded
window.addEventListener("load", function () {
  // Check if Memberstack 2.0 DOM object exists
  if (window.$memberstackDom) {
    // 1. Fetch fresh Memberstack data
    window.$memberstackDom
      .getCurrentMember()
      .then(({ data: member }) => {
        // 2. Wait 5 seconds, then redirect
        setTimeout(function () {
          window.location.href = "/devenir-membre";
        }, 8000);
      })
      .catch((err) => {
        // Fallback: Redirect anyway if there's an error
        setTimeout(function () {
          window.location.href = "/devenir-membre";
        }, 5000);
      });
  } else {
    console.warn("Memberstack DOM not found. Redirecting in 5s anyway...");
    setTimeout(function () {
      window.location.href = "/devenir-membre";
    }, 5000);
  }
});
