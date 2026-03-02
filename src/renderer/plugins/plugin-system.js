/**
 * Plugin System for Deepiri Emotion
 * Sandboxed plugin runtime with capability-based permissions (NeuralGPTOS-inspired).
 * Permissions: tasks, challenges, ui, storage, fabric_send, fabric_recv, memory_read, api_request
 */
const PLUGIN_CAPS = {
    tasks: ['tasks_create'],
    challenges: ['challenges_generate'],
    ui: ['fabric_send'],
    storage: [],
    fabric_send: ['fabric_send'],
    fabric_recv: ['fabric_recv'],
    memory_read: ['memory_read'],
    api_request: ['api_request']
};

function resolvePluginCaps(permissions) {
    let caps = [];
    for (const p of permissions || []) {
        const list = PLUGIN_CAPS[p] || (p.startsWith('cap:') ? [p.slice(4)] : []);
        caps = caps.concat(list);
    }
    return [...new Set(caps)];
}

class PluginSystem {
    constructor() {
        this.plugins = new Map();
        this.permissions = new Map();
        this.capabilities = new Map();
        this.sandbox = this.createSandbox();
    }

    createSandbox() {
        const self = this;
        return {
            api: {
                tasks: {
                    create: (task) => self.createTask(task),
                    list: () => self.listTasks(),
                    update: (id, updates) => self.updateTask(id, updates)
                },
                challenges: {
                    generate: (taskId) => self.generateChallenge(taskId),
                    start: (challengeId) => self.startChallenge(challengeId)
                },
                ui: {
                    showNotification: (message) => self.showNotification(message),
                    openPanel: (panelId) => self.openPanel(panelId)
                },
                fabric: {
                    send: (subject, data) => self.fabricSend(subject, data),
                    subscribe: (pattern, handler) => self.fabricSubscribe(pattern, handler)
                }
            },
            storage: {
                get: (key) => localStorage.getItem(`plugin_${key}`),
                set: (key, value) => localStorage.setItem(`plugin_${key}`, value)
            }
        };
    }

    _checkCap(pluginId, cap) {
        const caps = this.capabilities.get(pluginId) || [];
        if (!caps.includes(cap)) {
            console.warn(`Plugin ${pluginId} lacks capability: ${cap}`);
            return false;
        }
        return true;
    }

    fabricSend(subject, data) {
        if (typeof window.electronAPI?.fabricSend !== 'function') return Promise.resolve();
        return window.electronAPI.fabricSend(subject || 'plugin/event', data);
    }

    fabricSubscribe(pattern, handler) {
        if (typeof window.electronAPI?.fabricSubscribe !== 'function' || typeof window.electronAPI?.onFabricMessage !== 'function') return () => {};
        const state = { subId: null };
        window.electronAPI.fabricSubscribe(pattern || '*').then((r) => { state.subId = r?.subscriptionId; });
        const unsub = window.electronAPI.onFabricMessage((msg) => {
            if (!pattern || pattern === '*' || msg.subject === pattern) handler(msg);
        });
        return () => {
            unsub?.();
            if (state.subId != null) window.electronAPI.fabricUnsubscribe?.({ subscriptionId: state.subId });
        };
    }

    registerPlugin(pluginId, pluginCode, permissions = []) {
        try {
            const caps = resolvePluginCaps(permissions);
            this.capabilities.set(pluginId, caps);

            const pluginFunction = new Function('sandbox', `
                ${pluginCode}
                return { init, destroy, onMessage };
            `);

            const plugin = pluginFunction(this.sandbox);
            this.plugins.set(pluginId, plugin);
            this.permissions.set(pluginId, permissions);

            if (plugin.init) {
                plugin.init();
            }

            console.log(`Plugin registered: ${pluginId}`);
        } catch (error) {
            console.error(`Plugin registration failed: ${pluginId}`, error);
        }
    }

    unregisterPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (plugin && plugin.destroy) {
            plugin.destroy();
        }
        this.plugins.delete(pluginId);
        this.permissions.delete(pluginId);
        this.capabilities.delete(pluginId);
    }

    sendMessage(pluginId, message) {
        const plugin = this.plugins.get(pluginId);
        if (plugin && plugin.onMessage) {
            return plugin.onMessage(message);
        }
    }

    async createTask(task) {
        return await window.electronAPI.apiRequest({
            method: 'POST',
            endpoint: '/tasks',
            data: task
        });
    }

    async listTasks() {
        return await window.electronAPI.apiRequest({
            method: 'GET',
            endpoint: '/tasks'
        });
    }

    async updateTask(id, updates) {
        return await window.electronAPI.apiRequest({
            method: 'PATCH',
            endpoint: `/tasks/${id}`,
            data: updates
        });
    }

    async generateChallenge(taskId) {
        return await window.electronAPI.generateChallenge({ taskId });
    }

    startChallenge(challengeId) {
        return window.electronAPI.apiRequest({
            method: 'POST',
            endpoint: '/challenge/start',
            data: { challenge_id: challengeId }
        });
    }

    showNotification(message) {
        // Show system notification
        console.log('Notification:', message);
    }

    openPanel(panelId) {
        // Open IDE panel
        console.log('Opening panel:', panelId);
    }
}

// Example plugin: Pomodoro Timer
const pomodoroPlugin = `
function init() {
    console.log('Pomodoro plugin initialized');
    sandbox.api.ui.showNotification('Pomodoro timer ready!');
}

function destroy() {
    console.log('Pomodoro plugin destroyed');
}

function onMessage(message) {
    if (message.type === 'start') {
        startTimer(message.duration || 25);
    }
}

function startTimer(minutes) {
    let seconds = minutes * 60;
    const interval = setInterval(() => {
        seconds--;
        if (seconds <= 0) {
            clearInterval(interval);
            sandbox.api.ui.showNotification('Pomodoro complete!');
        }
    }, 1000);
}
`;

window.pluginSystem = new PluginSystem();

