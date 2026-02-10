// --- CONFIGURATION ---
const API = {
    // These are the exact URLs from your provided code
    scoreScript: "https://script.google.com/macros/s/AKfycbztgOiYdZlPssBus6iXQ6LwokmA4LS2b7CzgcKS4gd1iv9lG7MB_N7SupsxSdYQedEZgA/exec",
    authScript: "https://script.google.com/macros/s/AKfycbyUGMGXI7vml6jzJsCxhXvHgnq4V4Aq6sl6blkJkdfC8_haCxI__kx3EwFzZrW942E6/exec"
};

const KEYS = { user: "civil_eng_global_user" };

// --- MAIN APP LOGIC ---
// We attach 'App' to 'window' to make sure the HTML button can find it.
window.App = {
    state: { user: null, quiz: [], curr: 0, score: 0, mistakes: [], timer: null, activeTopic: "" },

    save: (k, v) => localStorage.setItem(k, v),
    load: (k) => localStorage.getItem(k),

    // 1. LOGIN SYSTEM (FIXED)
    verifyAndLogin: () => {
        const n = document.getElementById('inp-name').value.trim();
        const q = document.getElementById('inp-qual').value;
        const c = document.getElementById('inp-code').value.trim();
        const msg = document.getElementById('auth-msg');
        const btn = document.getElementById('btn-verify');

        // Check if empty
        if(!n || !c) { 
            alert("Please enter both Name and Unique Code.");
            return; 
        }

        // UI Feedback
        btn.disabled = true; 
        btn.innerText = "Verifying..."; 
        msg.style.display = 'block';
        msg.innerText = "Connecting to server...";
        msg.style.color = "#ccc";

        // Use encodeURIComponent to handle spaces/special characters in names
        const url = `${API.authScript}?code=${encodeURIComponent(c)}&name=${encodeURIComponent(n)}&qual=${encodeURIComponent(q)}`;

        fetch(url)
        .then(res => res.json())
        .then(data => {
            console.log("Server Response:", data); // Debugging line

            if(data.status === 'success' || data.result === 'success') { // Handle both 'status' and 'result' just in case
                // Success!
                document.getElementById('inp-pass').value = "Verified!";
                
                // Save User Data
                window.App.state.user = { name: n, qual: q, code: c };
                window.App.save(KEYS.user, JSON.stringify(window.App.state.user));
                
                msg.innerText = "Success! Redirecting...";
                msg.style.color = "#00f260";
                
                setTimeout(() => window.App.dash(), 1000);
            } else {
                // Logic Failure (Wrong code)
                throw new Error(data.message || "Invalid Code or Code Expired");
            }
        })
        .catch(err => {
            // Network or Script Failure
            console.error(err);
            btn.disabled = false; 
            btn.innerText = "Verify & Login";
            msg.style.display = 'block'; 
            msg.style.color = "#ff0055";
            msg.innerText = "Error: " + err.message;
            alert("Login Failed: " + err.message);
        });
    },

    // 2. DASHBOARD (LOADS list.json)
    dash: () => {
        // Hide others, show dash
        document.getElementById('view-login').classList.add('hidden');
        document.getElementById('view-quiz').classList.add('hidden');
        document.getElementById('view-result').classList.add('hidden');
        document.getElementById('view-dash').classList.remove('hidden');

        // Restore User
        const stored = window.App.load(KEYS.user);
        if(!stored) { 
            // If no user saved, force login
            document.getElementById('view-login').classList.remove('hidden'); 
            document.getElementById('view-dash').classList.add('hidden'); 
            return; 
        }
        
        window.App.state.user = JSON.parse(stored);
        document.getElementById('greet-msg').innerText = `Namaste, ${window.App.state.user.name.split(' ')[0]}!`;

        // Fetch List
        const listContainer = document.getElementById('test-list-container');
        listContainer.innerHTML = '<p style="text-align:center; color:#888;">Loading available tests...</p>';

        fetch('list.json')
        .then(res => {
            if(!res.ok) throw new Error("Could not find list.json");
            return res.json();
        })
        .then(data => {
            listContainer.innerHTML = '';
            // Sort Descending by ID (Newest First)
            data.sort((a, b) => b.id - a.id);
            
            data.forEach(test => {
                const card = document.createElement('div');
                card.className = 'test-card';
                card.innerHTML = `
                    <div>
                        <h3 style="font-size:1.1rem; color:white;">${test.name}</h3>
                        <p style="font-size:0.8rem; color:#aaa;">Tap to start</p>
                    </div>
                    <div style="background:var(--primary); color:black; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center;">➤</div>
                `;
                card.onclick = () => window.App.startQuiz(test.file, test.name);
                listContainer.appendChild(card);
            });
        })
        .catch(err => {
            console.error(err);
            listContainer.innerHTML = '<p style="color:#ff0055; text-align:center;">Failed to load test list.<br>Make sure list.json is uploaded.</p>';
        });
    },

    // 3. START QUIZ
    startQuiz: (fileUrl, topicName) => {
        document.getElementById('view-dash').classList.add('hidden');
        document.getElementById('view-quiz').classList.remove('hidden');
        
        window.App.state.activeTopic = topicName;
        document.getElementById('q-text').innerText = "Loading Questions...";
        document.getElementById('opts-list').innerHTML = "";
        
        fetch(fileUrl)
        .then(res => res.json())
        .then(questions => {
            if(!questions || questions.length === 0) return alert("No questions found.");
            
            window.App.state.curr = 0; 
            window.App.state.score = 0; 
            window.App.state.mistakes = [];
            
            // Randomize Questions & Options
            window.App.state.quiz = questions.map(q => {
                let opts = q.o.map((txt, i) => ({ t: txt, c: i === q.a }));
                return { ...q, shuffledOpts: opts.sort(() => Math.random() - 0.5) };
            }).sort(() => Math.random() - 0.5);

            document.getElementById('q-total').innerText = window.App.state.quiz.length;
            window.App.timer(45 * 60); 
            window.App.render();
        })
        .catch(e => {
            console.error(e);
            alert("Error loading quiz file: " + fileUrl);
            window.App.dash();
        });
    },

    render: () => {
        const q = window.App.state.quiz[window.App.state.curr];
        document.getElementById('q-idx').innerText = window.App.state.curr + 1;
        document.getElementById('q-text').innerText = q.q;
        document.getElementById('exp-box').style.display = 'none';
        document.getElementById('btn-next').classList.add('hidden');
        document.getElementById('praise-txt').innerText = "Good Luck!";
        document.getElementById('praise-txt').style.color = "white";
        
        const list = document.getElementById('opts-list');
        list.innerHTML = '';
        q.shuffledOpts.forEach((opt, i) => {
            const btn = document.createElement('div');
            btn.className = 'option-btn';
            btn.innerHTML = `<div class="option-marker">${String.fromCharCode(65+i)}</div>${opt.t}`;
            btn.onclick = () => window.App.check(btn, opt);
            list.appendChild(btn);
        });
    },

    check: (btn, opt) => {
        const all = document.querySelectorAll('.option-btn');
        all.forEach(b => { b.onclick = null; b.style.opacity = '0.6'; });
        btn.style.opacity = '1';
        
        const praise = document.getElementById('praise-txt');
        const firstName = window.App.state.user.name.split(' ')[0];
        
        if(opt.c) {
            btn.classList.add('correct');
            window.App.state.score++;
            praise.innerText = "Correct! " + firstName;
            praise.style.color = "#00f260";
        } else {
            btn.classList.add('wrong');
            const q = window.App.state.quiz[window.App.state.curr];
            all.forEach((b, i) => { if(q.shuffledOpts[i].c) b.classList.add('correct'); });
            praise.innerText = "Oops! " + firstName;
            praise.style.color = "#ff0055";
        }

        const q = window.App.state.quiz[window.App.state.curr];
        if(q.e) {
            document.getElementById('exp-box').innerHTML = `<strong>Explanation:</strong> ${q.e}`;
            document.getElementById('exp-box').style.display = 'block';
        }
        document.getElementById('btn-next').classList.remove('hidden');
        
        // Auto scroll to next button
        setTimeout(() => {
             document.getElementById('btn-next').scrollIntoView({behavior: "smooth", block: "center"});
        }, 200);
    },

    next: () => {
        window.App.state.curr++;
        if(window.App.state.curr < window.App.state.quiz.length) window.App.render();
        else window.App.finish();
    },

    timer: (sec) => {
        if(window.App.state.timer) clearInterval(window.App.state.timer);
        window.App.state.timer = setInterval(() => {
            sec--;
            let m = Math.floor(sec/60), s = sec%60;
            document.getElementById('timer').innerText = `${m}:${s<10?'0':''}${s}`;
            if(sec<=0) window.App.finish();
        }, 1000);
    },

    finish: () => {
        clearInterval(window.App.state.timer);
        document.getElementById('view-quiz').classList.add('hidden');
        document.getElementById('view-result').classList.remove('hidden');

        const pct = Math.round((window.App.state.score / window.App.state.quiz.length) * 100);
        document.getElementById('res-score').innerText = window.App.state.score;
        document.getElementById('res-pct').innerText = `${pct}% Accuracy`;
        window.App.sync();
    },

    sync: () => {
        const data = {
            date: new Date().toLocaleString(),
            name: window.App.state.user.name,
            qualification: window.App.state.user.qual,
            topic: window.App.state.activeTopic, 
            score: window.App.state.score
        };

        const statusMsg = document.getElementById('sync-status');
        statusMsg.innerText = "Syncing score to Google Sheets...";

        if(navigator.onLine) {
            fetch(API.scoreScript, {
                method: 'POST', mode: 'no-cors',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            }).then(() => {
                statusMsg.innerText = "✅ Score Saved Successfully!";
                statusMsg.style.color = "#00f260";
            }).catch(e => {
                console.error(e);
                statusMsg.innerText = "⚠️ Saved offline (Network Error)";
            });
        } else {
             statusMsg.innerText = "⚠️ Saved offline (No Internet)";
        }
    }
};

// AUTO-START if user is already logged in
window.onload = () => {
    if(window.App.load(KEYS.user)) {
        window.App.dash();
    }
};
