/**
 * Deepiri Emotion Renderer Process
 * IDE-style app with gamification
 */

class DeepiriIDE {
    constructor() {
        this.activeTabs = [];
        this.currentChallenge = null;
        this.points = 0;
        this.level = 1;
        this.streak = 0;
        this.timer = null;
        this.init();
    }

    init() {
        this.setupActivityBar();
        this.setupTabs();
        this.setupWelcomeScreen();
        this.setupGamification();
        this.loadGamificationData();
    }

    setupActivityBar() {
        const items = document.querySelectorAll('.activity-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                items.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                this.switchView(item.dataset.view);
            });
        });
    }

    switchView(view) {
        const views = document.querySelectorAll('.sidebar-content');
        views.forEach(v => v.classList.add('hidden'));
        
        const targetView = document.getElementById(`${view}-view`);
        if (targetView) {
            targetView.classList.remove('hidden');
        }
    }

    setupTabs() {
        // Tab management will be implemented here
    }

    setupWelcomeScreen() {
        document.getElementById('new-task-btn')?.addEventListener('click', () => {
            this.createNewTask();
        });
        
        document.getElementById('new-challenge-btn')?.addEventListener('click', () => {
            this.generateChallenge();
        });
        
        document.getElementById('open-project-btn')?.addEventListener('click', () => {
            this.openProject();
        });
    }

    async createNewTask() {
        const taskTitle = prompt('Enter task title:');
        if (!taskTitle) return;

        try {
            const result = await window.electronAPI.classifyTask(taskTitle);
            if (result.success) {
                this.openTaskEditor(taskTitle, result.data.classification);
            }
        } catch (error) {
            console.error('Error creating task:', error);
        }
    }

    async generateChallenge() {
        const taskTitle = prompt('Enter task for challenge:');
        if (!taskTitle) return;

        try {
            const result = await window.electronAPI.generateChallenge({
                title: taskTitle,
                type: 'manual',
                estimatedDuration: 30
            });

            if (result.success) {
                this.startChallenge(result.data.data);
            }
        } catch (error) {
            console.error('Error generating challenge:', error);
        }
    }

    startChallenge(challengeData) {
        this.currentChallenge = challengeData;
        this.hideWelcomeScreen();
        this.showChallengeEditor(challengeData);
        this.updateChallengeStatus(challengeData.title);
        this.startTimer(challengeData.configuration?.timeLimit || 30);
    }

    showChallengeEditor(challenge) {
        const editor = document.getElementById('editor');
        editor.innerHTML = `
            <div class="editor-content">
                <div style="padding: 20px;">
                    <h2 style="color: #5ba3d0; margin-bottom: 16px;">${challenge.title}</h2>
                    <p style="color: #c5dceb; margin-bottom: 24px;">${challenge.description}</p>
                    <div style="background: #243b4a; padding: 16px; border-radius: 6px; margin-bottom: 16px; border: 1px solid #2a4a5e;">
                        <div style="margin-bottom: 8px;"><strong>Difficulty:</strong> ${challenge.difficulty}</div>
                        <div style="margin-bottom: 8px;"><strong>Points Reward:</strong> ${challenge.pointsReward}</div>
                        <div><strong>Time Limit:</strong> ${challenge.configuration?.timeLimit || 'N/A'} minutes</div>
                    </div>
                    <textarea class="code-editor" placeholder="Start working on your challenge..."></textarea>
                </div>
            </div>
        `;
    }

    hideWelcomeScreen() {
        const welcome = document.getElementById('welcome-screen');
        if (welcome) {
            welcome.style.display = 'none';
        }
    }

    startTimer(minutes) {
        let seconds = minutes * 60;
        this.timer = setInterval(() => {
            seconds--;
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            document.getElementById('timer-display').textContent = 
                `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            
            if (seconds <= 0) {
                clearInterval(this.timer);
                this.completeChallenge();
            }
        }, 1000);
    }

    updateChallengeStatus(status) {
        document.getElementById('challenge-status').textContent = status;
    }

    completeChallenge() {
        if (this.currentChallenge) {
            this.points += this.currentChallenge.pointsReward || 100;
            this.updateGamification();
            alert(`Challenge completed! +${this.currentChallenge.pointsReward} points`);
            this.currentChallenge = null;
        }
    }

    setupGamification() {
        // Gamification setup
    }

    async loadGamificationData() {
        try {
            const result = await window.electronAPI.apiRequest({
                method: 'GET',
                endpoint: '/gamification/points'
            });
            
            if (result.success) {
                this.points = result.data.points || 0;
                this.level = result.data.level || 1;
                this.streak = result.data.streak || 0;
                this.updateGamification();
            }
        } catch (error) {
            console.error('Error loading gamification data:', error);
        }
    }

    updateGamification() {
        document.getElementById('points-value').textContent = this.points;
        document.getElementById('level-value').textContent = this.level;
        document.getElementById('streak-value').textContent = this.streak;
        document.getElementById('points-display').textContent = `${this.points} points`;
    }

    openTaskEditor(title, classification) {
        // Open task in editor
        console.log('Opening task:', title, classification);
    }

    openProject() {
        // Open project dialog
        console.log('Opening project');
    }
}

// Initialize IDE when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.ide = new DeepiriIDE();
});

