document.addEventListener('DOMContentLoaded', () => {
    // --- Feature Detection ---
    const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // --- Element Selectors ---
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    const body = document.body;
    const selectionPage = document.getElementById('selection-page');
    const exercisePage = document.getElementById('exercise-page');
    const cards = document.querySelectorAll('.card');
    const backButton = document.getElementById('back-button');
    const playPauseButton = document.getElementById('play-pause-button');
    const stopButton = document.getElementById('stop-button');
    const ring = document.querySelector('.ring');
    const phaseTimerDisplay = document.getElementById('phase-timer');
    const instructionDisplay = document.getElementById('instruction');
    const initialInstructionDisplay = document.getElementById('initial-instruction');
    const sessionTimerDisplay = document.getElementById('session-timer-display');
    const setTimerButton = document.getElementById('set-timer-button');
    const timerInputContainer = document.getElementById('timer-input-container');
    const timerInput = document.getElementById('timer-input');
    const customSelectWrapper = document.querySelector('.custom-select-wrapper');
    const customSelect = document.querySelector('.custom-select');
    const customOptions = document.querySelectorAll('.custom-option');
    const selectedSoundDisplay = document.getElementById('selected-sound-display');
    const volumeSlider = document.getElementById('volume-slider');

    // --- State Variables ---
    let sessionTimerInterval, phaseTimeout, phaseCountdownInterval;
    let currentTechnique = null;
    let isPaused = true;
    let exerciseStarted = false;
    let totalSessionTime = 300; // Default 5 minutes
    let remainingSessionTime = totalSessionTime;
    const audio = new Audio();
    let currentPhaseIndex = 0;
    let remainingPhaseTime = 0;
    let wakeLock = null;

    const techniques = {
        balanced: { name: 'Balanced Breathing', pattern: [{ instruction: 'Inhale', duration: 5 }, { instruction: 'Exhale', duration: 5 }] },
        relaxing: { name: 'Relaxing Breath', pattern: [{ instruction: 'Inhale', duration: 4 }, { instruction: 'Hold', duration: 7 }, { instruction: 'Exhale', duration: 8 }] },
        box: { name: 'Box Breathing', pattern: [{ instruction: 'Inhale', duration: 4 }, { instruction: 'Hold', duration: 4 }, { instruction: 'Exhale', duration: 4 }, { instruction: 'Hold', duration: 4 }] },
        mindful: { name: 'Mindful Breath', pattern: [{ instruction: 'Inhale', duration: 4 }, { instruction: 'Exhale', duration: 6 }] },
        energizing: { name: 'Energizing Breath', pattern: [{ instruction: 'Inhale', duration: 4 }, { instruction: 'Hold', duration: 2 }, { instruction: 'Exhale', duration: 6 }] }
    };

    // --- Haptic Feedback ---
    const vibrate = (pattern) => {
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate(pattern);
            } catch (error) {
                console.error("Haptic feedback failed:", error);
            }
        }
    };

    // --- Wake Lock ---
    const requestWakeLock = async () => {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Screen Wake Lock is active.');
            } catch (err) {
                console.error(`${err.name}, ${err.message}`);
            }
        }
    };

    const releaseWakeLock = async () => {
        if (wakeLock !== null) {
            try {
                await wakeLock.release();
                wakeLock = null;
                console.log('Screen Wake Lock has been released.');
            } catch (err) {
                console.error(`${err.name}, ${err.message}`);
            }
        }
    };

    // --- Theme Management ---
    const applyTheme = (isDark) => {
        body.classList.toggle('dark-mode', isDark);
        body.classList.toggle('light-mode', !isDark);
        sunIcon.classList.toggle('hidden', isDark);
        moonIcon.classList.toggle('hidden', !isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    };

    [sunIcon, moonIcon].forEach(icon => icon.addEventListener('click', () => applyTheme(!body.classList.contains('dark-mode'))));
    const savedTheme = localStorage.getItem('theme') === 'dark';
    applyTheme(savedTheme);

    // --- Page Navigation ---
    cards.forEach(card => {
        card.addEventListener('click', () => {
            currentTechnique = card.getAttribute('data-technique');
            selectionPage.classList.add('hidden');
            exercisePage.classList.remove('hidden');
            resetExerciseState();
        });
    });

    backButton.addEventListener('click', () => {
        selectionPage.classList.remove('hidden');
        exercisePage.classList.add('hidden');
        stopExercise();
    });

    // --- Exercise Logic ---
    const resetExerciseState = () => {
        stopExercise();
        totalSessionTime = 300; // Reset to default 5 minutes
        remainingSessionTime = totalSessionTime;
        timerInput.value = 5; // Reset input field to 5
        updateSessionTimerDisplay();
        initialInstructionDisplay.classList.remove('hidden');
        instructionDisplay.classList.add('hidden');
        selectedSoundDisplay.textContent = "None";
        customOptions.forEach(opt => opt.classList.remove('selected'));
        document.querySelector('.custom-option[data-value="none"]').classList.add('selected');
    };

    const startExercise = () => {
        exerciseStarted = true;
        isPaused = false;
        playPauseButton.innerHTML = '<i class="fas fa-pause"></i>';
        remainingSessionTime = totalSessionTime;
        updateSessionTimerDisplay();
        currentPhaseIndex = 0;
        initialInstructionDisplay.classList.add('hidden');
        instructionDisplay.classList.remove('hidden');
        requestWakeLock();
        runCycle(currentPhaseIndex);
        startSessionTimer();
    };

    const stopExercise = () => {
        isPaused = true;
        exerciseStarted = false;
        clearTimeout(phaseTimeout);
        clearInterval(phaseCountdownInterval);
        clearInterval(sessionTimerInterval);
        audio.pause();
        audio.src = '';
        ring.style.animation = '';
        ring.style.transform = 'scale(0.8)';
        playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
        phaseTimerDisplay.textContent = '';
        instructionDisplay.textContent = '';
        initialInstructionDisplay.classList.remove('hidden');
        releaseWakeLock();
    };

    const runCycle = (phaseIndex) => {
        if (isPaused) return;
        currentPhaseIndex = phaseIndex;
        const { pattern } = techniques[currentTechnique];
        const phase = pattern[phaseIndex];
        
        instructionDisplay.textContent = phase.instruction;
        animateRing(phase.instruction, phase.duration);
        
        if (phase.instruction === 'Inhale') vibrate(200);
        else if (phase.instruction === 'Exhale') vibrate([100, 50, 100]);

        remainingPhaseTime = phase.duration;
        countdownPhase();

        phaseTimeout = setTimeout(() => {
            runCycle((phaseIndex + 1) % pattern.length);
        }, phase.duration * 1000);
    };

    const countdownPhase = () => {
        clearInterval(phaseCountdownInterval);
        phaseTimerDisplay.textContent = remainingPhaseTime;
        phaseCountdownInterval = setInterval(() => {
            if (!isPaused) {
                remainingPhaseTime--;
                phaseTimerDisplay.textContent = remainingPhaseTime > 0 ? remainingPhaseTime : '';
                if (remainingPhaseTime <= 0) clearInterval(phaseCountdownInterval);
            }
        }, 1000);
    };

    const animateRing = (instruction, duration) => {
        ring.style.animationPlayState = 'running';
        if (instruction === 'Inhale') {
            ring.style.animationName = 'ring-inhale';
            ring.style.animationDuration = `${duration}s`;
        } else if (instruction === 'Exhale') {
            ring.style.animationName = 'ring-exhale';
            ring.style.animationDuration = `${duration}s`;
        } else {
            ring.style.animationPlayState = 'paused';
        }
    };

    // --- Timers ---
    const startSessionTimer = () => {
        clearInterval(sessionTimerInterval);
        sessionTimerInterval = setInterval(() => {
            if (!isPaused) {
                remainingSessionTime--;
                updateSessionTimerDisplay();
                if (remainingSessionTime <= 0) {
                    stopExercise();
                    vibrate([500, 100, 500]); // Vibrate on completion
                    alert('Session Complete!');
                    backButton.click();
                }
            }
        }, 1000);
    };

    const updateSessionTimerDisplay = () => {
        const minutes = Math.floor(remainingSessionTime / 60).toString().padStart(2, '0');
        const seconds = (remainingSessionTime % 60).toString().padStart(2, '0');
        sessionTimerDisplay.textContent = `${minutes}:${seconds}`;
    };

    setTimerButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent closing from window listener
        if (!exerciseStarted) {
            timerInputContainer.classList.toggle('hidden');
        }
    });

    timerInput.addEventListener('change', () => {
        const newTime = parseInt(timerInput.value, 10);
        if (newTime > 0 && newTime <= 60) {
            totalSessionTime = newTime * 60;
            remainingSessionTime = totalSessionTime;
            updateSessionTimerDisplay();
        }
    });
    
    timerInput.addEventListener('blur', () => { // Hide when focus is lost
        timerInputContainer.classList.add('hidden');
    });

    // --- Controls ---
    playPauseButton.addEventListener('click', () => {
        if (!exerciseStarted) {
            startExercise();
        } else {
            isPaused = !isPaused;
            playPauseButton.innerHTML = isPaused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
            if (isPaused) {
                clearTimeout(phaseTimeout);
                clearInterval(phaseCountdownInterval);
                ring.style.animationPlayState = 'paused';
                audio.pause();
                releaseWakeLock();
            } else {
                resumeExercise();
                ring.style.animationPlayState = 'running';
                if (audio.src) audio.play();
                requestWakeLock();
            }
        }
    });

    stopButton.addEventListener('click', () => {
        stopExercise();
        resetExerciseState();
    });

    const resumeExercise = () => {
        countdownPhase();
        phaseTimeout = setTimeout(() => {
            runCycle((currentPhaseIndex + 1) % techniques[currentTechnique].pattern.length);
        }, remainingPhaseTime * 1000);
    };

    // --- Audio Controls ---
    customSelect.addEventListener('click', (e) => {
        e.stopPropagation();
        customSelect.classList.toggle('open');
    });

    customOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const sound = option.getAttribute('data-value');
            const soundName = option.textContent;
            selectedSoundDisplay.textContent = soundName;

            customOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            if (sound === 'none') {
                audio.pause();
                audio.src = '';
            } else {
                audio.src = `sounds/${sound}.mp3`;
                audio.loop = true;
                if (!isPaused) audio.play();
            }
            customSelect.classList.remove('open');
        });
    });

    volumeSlider.addEventListener('input', (e) => audio.volume = e.target.value);

    // --- Global Event Listeners ---
    window.addEventListener('click', (e) => {
        // Close custom select if open
        if (customSelect.classList.contains('open')) {
            customSelect.classList.remove('open');
        }
        // Hide timer input if open and not the target
        if (!timerInputContainer.classList.contains('hidden') && !timerInputContainer.contains(e.target) && e.target !== setTimerButton) {
            timerInputContainer.classList.add('hidden');
        }
    });
    
    // Add touchstart for faster response on mobile for certain buttons
    if (isTouchDevice()) {
        const quickActionButtons = [playPauseButton, stopButton, backButton];
        quickActionButtons.forEach(button => {
            button.addEventListener('touchstart', (e) => {
                e.preventDefault(); // Prevent double-tap zoom and ghost clicks
                button.click();
            });
        });
    }

    // Initial setup
    resetExerciseState();
});