const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggleBtn = document.querySelector("#theme-toggle-btn");
// API Setup
const API_KEY = "AIzaSyABYz-8oiFYesjno-p-3UAkvoJsBBKodlw"; // Your API key here
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
let controller, typingInterval;
// Initialize empty chat history array
let chatHistory = [];

const userData = { message: "", file: {} };


// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem("themeColor");
  const isLightTheme = savedTheme === null ? true : savedTheme === "light_mode";
  document.body.classList.toggle("light-theme", isLightTheme);
  document.querySelector("#theme-toggle-btn").textContent = isLightTheme ? "dark_mode" : "light_mode";
  localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
});
// Function to create message elements
const createMessageElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};
// Scroll to the bottom of the container
const scrollToBottom = () => {
  const content = document.querySelector(".content");
  content.scrollTo({ top: content.scrollHeight, behavior: "smooth" });
};
// Simulate typing effect for bot responses
const typingEffect = (text, textElement, botMsgDiv) => {
  textElement.innerHTML = "";
  const processCodeBlocks = (text) => {
    let processedText = text;
    const codeBlocks = [];

    // Extract code blocks
    processedText = processedText.replace(/```([\s\S]*?)```/g, (match, code) => {
      const codeContent = code.trim();
      const escapedCode = codeContent
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

      return `<pre><code>${escapedCode}</code></pre>`;
    });

    // Create code cards
    if (codeBlocks.length > 0) {
      processedText += '<div class="code-cards">';
      codeBlocks.forEach((code, index) => {
        const escapedCode = code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');

        processedText += `
          <div class="code-card">
            <div class="code-card-header">Code Block ${index + 1}</div>
            <pre><code>${escapedCode}</code></pre>
            <button class="copy-btn" onclick="navigator.clipboard.writeText(\`${code.replace(/`/g, '\\`')}\`)">
              Copy Code
            </button>
          </div>`;
      });
      processedText += '</div>';
    }

    return processedText;
  };

  const formattedText = processCodeBlocks(text);
  textElement.innerHTML = formattedText;
  scrollToBottom();
  clearInterval(typingInterval);
  botMsgDiv.classList.remove("loading");
  document.body.classList.remove("bot-responding");
};
// Make the API call and generate the bot's response
const generateResponse = async (botMsgDiv) => {
  const textElement = botMsgDiv.querySelector(".message-text");
  controller = new AbortController();
  chatHistory.push({
    role: "user",
    parts: [{ text: userData.message }, ...(userData.file.data ? [{ inline_data: (({ fileName, isImage, ...rest }) => rest)(userData.file) }] : [])],
  });
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: chatHistory }),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error.message);

    const responseText = data.candidates[0].content.parts[0].text.trim();
    let currentText = '';
    const words = responseText.split(' ');
    
    for (let i = 0; i < words.length; i++) {
      if (controller.signal.aborted) break;
      
      currentText += words[i] + ' ';
      let formattedText = currentText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');

      formattedText = formattedText.replace(/```([\s\S]*?)```/g, (match, code) => {
        const lang = code.split('\n')[0].trim() || 'CODE';
        const actualCode = code.split('\n').slice(1).join('\n').trim() || code.trim();
        
        return `<div class="code-card">
          <div class="code-header">${lang}</div>
          <pre><code>${actualCode.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')}</code></pre>
          <button class="copy-btn" onclick="navigator.clipboard.writeText(\`${actualCode.replace(/`/g, '\\`')}\`)">Copy Code</button>
        </div>`;
      });
      
      textElement.innerHTML = formattedText;
      scrollToBottom();
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    // After typing effect completes
    document.querySelector("#stop-response-btn").style.display = "none";
    document.querySelector("#send-prompt-btn").style.display = "block";
    document.body.classList.remove("bot-responding");
    chatHistory.push({ role: "model", parts: [{ text: responseText }] });
  } catch (error) {
    textElement.textContent = error.name === "AbortError" ? "Response generation stopped." : error.message;
    textElement.style.color = "#d62939";
    botMsgDiv.classList.remove("loading");
    document.body.classList.remove("bot-responding");
    document.querySelector("#stop-response-btn").style.display = "none";
    document.querySelector("#send-prompt-btn").style.display = "block";
    scrollToBottom();
  } finally {
    userData.file = {};
  }
};
// Handle the form submission
const handleFormSubmit = (e) => {
  e.preventDefault();
  const userMessage = promptInput.value.trim();
  if (!userMessage || document.body.classList.contains("bot-responding")) return;
  userData.message = userMessage;
  promptInput.value = "";
  document.body.classList.add("chats-active", "bot-responding");
  fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");

  // Generate user message HTML with optional file attachment
  const userMsgHTML = `
    <p class="message-text"></p>
    ${userData.file.data ? (userData.file.isImage ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" />` : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`) : ""}
  `;
  const userMsgDiv = createMessageElement(userMsgHTML, "user-message");
  userMsgDiv.querySelector(".message-text").textContent = userData.message;
  chatsContainer.appendChild(userMsgDiv);
  scrollToBottom();

  // Hide welcome screen when chat starts
  const welcomeScreen = document.querySelector(".welcome-screen");
  if (welcomeScreen) welcomeScreen.style.display = "none";

  // Generate bot message
  setTimeout(() => {
    const botMsgHTML = `<img class="avatar" src="images/CipherAI.jpg" /> <p class="message-text">Just a sec...</p>`;
    const botMsgDiv = createMessageElement(botMsgHTML, "bot-message", "loading");
    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();
    generateResponse(botMsgDiv);
  }, 300);
};
// Handle file input change (file upload)
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  const isImage = file.type.startsWith("image/");
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (e) => {
    fileInput.value = "";
    const base64String = e.target.result.split(",")[1];
    fileUploadWrapper.querySelector(".file-preview").src = e.target.result;
    fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");
    // Store file data in userData obj
    userData.file = { fileName: file.name, data: base64String, mime_type: file.type, isImage };
  };
});
// Cancel file upload
document.querySelector("#cancel-file-btn").addEventListener("click", () => {
  userData.file = {};
  fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");
});
// Stop Bot Response
document.querySelector("#stop-response-btn").addEventListener("click", () => {
  controller?.abort();
  userData.file = {};
  clearInterval(typingInterval);
  chatsContainer.querySelector(".bot-message.loading").classList.remove("loading");
  document.body.classList.remove("bot-responding");
});
// Toggle dark/light theme
document.querySelector("#theme-toggle-btn").addEventListener("click", () => {
  const isLightTheme = document.body.classList.toggle("light-theme");
  localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
  document.querySelector("#theme-toggle-btn").textContent = isLightTheme ? "dark_mode" : "light_mode";
});
// Delete all chats
document.querySelector("#delete-chats-btn").addEventListener("click", () => {
  if (confirm("Are you sure you want to delete all chats?")) {
    chatHistory = [];
    chatsContainer.innerHTML = "";
    document.body.classList.remove("chats-active", "bot-responding");
    document.querySelector(".welcome-screen").style.display = "block";
  }
});
// Handle suggestions click
document.querySelectorAll(".suggestion-card").forEach((card) => {
  card.addEventListener("click", () => {
    const suggestion = card.getAttribute("data-suggestion");
    promptInput.value = suggestion;
    promptForm.dispatchEvent(new Event("submit"));
  });
});
// Show/hide controls for mobile on prompt input focus
document.addEventListener("click", ({ target }) => {
  const wrapper = document.querySelector(".prompt-wrapper");
  const shouldHide = target.classList.contains("prompt-input") || (wrapper.classList.contains("hide-controls") && (target.id === "add-file-btn" || target.id === "stop-response-btn"));
  wrapper.classList.toggle("hide-controls", shouldHide);
});
// Add event listeners for form submission and file input click
promptForm.addEventListener("submit", handleFormSubmit);
promptForm.querySelector("#add-file-btn").addEventListener("click", () => fileInput.click());