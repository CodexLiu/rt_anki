document.addEventListener('DOMContentLoaded', function() {
    const categoriesListDiv = document.getElementById('categories-list');
    const startButton = document.getElementById('start-button');
    const problemArea = document.getElementById('problem-area');
    const questionTextElem = document.getElementById('question-text');
    const questionAudioElem = document.getElementById('question-audio');
    const feedbackArea = document.getElementById('feedback-area');
    const feedbackTextElem = document.getElementById('feedback-text');
    const correctAnswerTextElem = document.getElementById('correct-answer-text');
    const explanationTextElem = document.getElementById('explanation-text');
    const followUpButton = document.getElementById('follow-up-button');
    const followUpInputArea = document.getElementById('follow-up-input-area');
    const followUpQuestionTextElem = document.getElementById('follow-up-question-text');
    const submitFollowUpButton = document.getElementById('submit-follow-up-button');
    const nextQuestionButton = document.getElementById('next-question-button');

    const replayQuestionAudioButton = document.getElementById('replay-question-audio-button');
    const replayContextualAudioButton = document.getElementById('replay-contextual-audio-button');

    const homeButton = document.getElementById('home-button');

    const recordAnswerButton = document.getElementById('record-answer-button');
    const recordFollowUpButton = document.getElementById('record-follow-up-button');

    const infoPopupOverlay = document.getElementById('info-popup-overlay');
    const infoPopupModal = document.getElementById('info-popup-modal');
    const infoPopupCloseButton = document.getElementById('info-popup-close-button');

    let currentProblem = null;
    let selectedCategories = [];
    let mediaRecorder;
    let audioChunks = [];
    let currentTargetInputId = null;
    let maxRecordTimer = null;
    const MAX_RECORD_TIME_MS = 4000;
    let recordStartTime = 0;
    let animationFrameId = null;

    console.log('Script loaded. Hold-to-record implementation. Max time (ms):', MAX_RECORD_TIME_MS);

    async function requestMicrophoneAccess() {
        console.log('Requesting microphone access...');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('Microphone access granted.');
            return stream;
        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Microphone access denied. Please enable microphone permissions in your browser settings.');
            return null;
        }
    }

    async function startRecording(targetConceptId) {
        console.log('[Record] Mouse down. Attempting to start recording for target:', targetConceptId);
        if (mediaRecorder && mediaRecorder.state === "recording") {
            console.log('[Record] Already recording. Ignoring mouse down.');
            return;
        }

        replayQuestionAudioButton.disabled = true;
        replayContextualAudioButton.disabled = true;

        const stream = await requestMicrophoneAccess();
        if (!stream) {
            console.log('[Record] Microphone stream not available. Aborting startRecording.');
            return;
        }

        currentTargetInputId = targetConceptId;
        audioChunks = [];
        console.log('[Record] Initialized audioChunks.');

        try {
            mediaRecorder = new MediaRecorder(stream);
            console.log('[Record] MediaRecorder instance created.');

            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                console.log('[MediaRecorder] onstop event triggered. MediaRecorder state:', mediaRecorder.state);
                clearTimeout(maxRecordTimer); 
                maxRecordTimer = null;
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;

                // Re-enable appropriate replay button
                if (problemArea.style.display === 'block') {
                    replayQuestionAudioButton.disabled = false;
                } else if (feedbackArea.style.display === 'block') {
                    replayContextualAudioButton.disabled = false;
                }

                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                console.log('[MediaRecorder] onstop: Audio blob created. Size:', audioBlob.size, 'Chunks used:', audioChunks.length);
                
                const recordBtn = (currentTargetInputId === 'user-answer-text') ? recordAnswerButton : recordFollowUpButton;
                const submitBtn = (currentTargetInputId === 'user-answer-text') ? null : submitFollowUpButton;
                const slider = recordBtn ? recordBtn.querySelector('.record-progress-slider') : null;
                const buttonText = recordBtn ? recordBtn.querySelector('.button-text') : null;

                if (audioChunks.length > 0 && audioBlob.size > 0) {
                    console.log('[MediaRecorder] onstop: Sending audio for transcription.');
                    sendAudioForTranscription(audioBlob, currentTargetInputId);
                } else {
                    console.log('[MediaRecorder] onstop: No audio chunks to send or blob is empty. Not sending. Resetting UI.');
                    if (recordBtn) {
                        recordBtn.classList.remove('bg-red-600', 'p-4', 'text-lg');
                        recordBtn.classList.add('bg-green-500', 'hover:bg-green-600', 'py-2', 'px-4');
                        if (slider) slider.style.width = '0%';
                        if (buttonText) {
                             buttonText.textContent = recordBtn.id === 'record-answer-button' ? "Hold to Record Answer" : "Hold to Record Follow-up";
                        }
                         recordBtn.disabled = false;
                    }
                    if (currentTargetInputId === 'user-answer-text') {
                        alert("No audio detected. Please try recording your answer again.");
                    } else {
                        const targetInputElement = document.getElementById(currentTargetInputId);
                        const originalPlaceholder = targetInputElement ? targetInputElement.dataset.originalPlaceholder : "Type or speak your answer";
                        if (targetInputElement) {
                            targetInputElement.placeholder = originalPlaceholder;
                            targetInputElement.disabled = false;
                        }
                        if (submitBtn) submitBtn.disabled = false;
                    }
                }
                stream.getTracks().forEach(track => track.stop());
                console.log('[MediaRecorder] onstop: Microphone tracks stopped.');
            };

            mediaRecorder.onerror = (event) => {
                console.error('[MediaRecorder] onerror event:', event.error);
                alert(`MediaRecorder error: ${event.error.name} - ${event.error.message}`);
                clearTimeout(maxRecordTimer);
                maxRecordTimer = null;
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;

                // Re-enable appropriate replay button
                if (problemArea.style.display === 'block') {
                    replayQuestionAudioButton.disabled = false;
                } else if (feedbackArea.style.display === 'block') {
                    replayContextualAudioButton.disabled = false;
                }

                const recordBtn = (currentTargetInputId === 'user-answer-text') ? recordAnswerButton : recordFollowUpButton;
                if (recordBtn) {
                    const slider = recordBtn.querySelector('.record-progress-slider');
                    const buttonText = recordBtn.querySelector('.button-text');
                    recordBtn.classList.remove('bg-red-600', 'p-4', 'text-lg');
                    recordBtn.classList.add('bg-green-500', 'hover:bg-green-600', 'py-2', 'px-4');
                    if (slider) slider.style.width = '0%';
                    if (buttonText) buttonText.textContent = recordBtn.id === 'record-answer-button' ? "Hold to Record Answer" : "Hold to Record Follow-up";
                    recordBtn.disabled = false;
                }
                if (currentTargetInputId !== 'user-answer-text' && submitFollowUpButton) {
                     submitFollowUpButton.disabled = false;
                }
            };

            mediaRecorder.start(); 
            console.log('[Record] MediaRecorder started. State:', mediaRecorder.state);
            recordStartTime = Date.now();
            animationFrameId = requestAnimationFrame(updateRecordProgress);

            maxRecordTimer = setTimeout(() => {
                console.log('[Record] Max recording time (8s) reached. Stopping recording.');
                if (mediaRecorder && mediaRecorder.state === "recording") {
                    stopRecording(currentTargetInputId, true); 
                }
                maxRecordTimer = null; 
            }, MAX_RECORD_TIME_MS);

            const recordBtnToUpdate = (targetConceptId === 'user-answer-text') ? recordAnswerButton : recordFollowUpButton;
            if (recordBtnToUpdate) {
                const buttonText = recordBtnToUpdate.querySelector('.button-text');
                recordBtnToUpdate.classList.remove('bg-green-500', 'hover:bg-green-600', 'py-2', 'px-4');
                recordBtnToUpdate.classList.add('bg-red-600', 'p-4', 'text-lg'); // Big and Red
                if (buttonText) buttonText.textContent = "Recording... Release to Stop";
            }
            if (targetConceptId === 'follow-up-question-text' && submitFollowUpButton) {
                submitFollowUpButton.disabled = true;
            }

        } catch (e) {
            console.error('[Record] Outer error creating MediaRecorder or setting up:', e);
            alert('Error initializing recorder. Please ensure microphone permissions are granted and try again.');
            if (stream) stream.getTracks().forEach(track => track.stop());
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;

            const recordBtnToReset = (currentTargetInputId === 'user-answer-text') ? recordAnswerButton : recordFollowUpButton;
            if (recordBtnToReset) {
                const slider = recordBtnToReset.querySelector('.record-progress-slider');
                const buttonText = recordBtnToReset.querySelector('.button-text');
                recordBtnToReset.classList.remove('bg-red-600', 'p-4', 'text-lg');
                recordBtnToReset.classList.add('bg-green-500', 'hover:bg-green-600', 'py-2', 'px-4');
                if (slider) slider.style.width = '0%';
                if (buttonText) buttonText.textContent = recordBtnToReset.id === 'record-answer-button' ? "Hold to Record Answer" : "Hold to Record Follow-up";
                recordBtnToReset.disabled = false;
            }
            if (currentTargetInputId === 'follow-up-question-text' && submitFollowUpButton) {
                 submitFollowUpButton.disabled = false;
            }
            return;
        }
        console.log('[Record] startRecording (mousedown) completed for target:', targetConceptId);
    }

    function updateRecordProgress(timestamp) {
        if (!mediaRecorder || mediaRecorder.state !== 'recording') {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            return;
        }

        const elapsedTime = Date.now() - recordStartTime;
        let progress = (elapsedTime / MAX_RECORD_TIME_MS) * 100;
        progress = Math.min(progress, 100); // Cap at 100%

        const recordBtn = (currentTargetInputId === 'user-answer-text') ? recordAnswerButton : recordFollowUpButton;
        if (recordBtn) {
            const slider = recordBtn.querySelector('.record-progress-slider');
            if (slider) {
                slider.style.width = `${progress}%`;
            }
        }

        if (elapsedTime < MAX_RECORD_TIME_MS) {
            animationFrameId = requestAnimationFrame(updateRecordProgress);
        } else {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
             // Max time logic is handled by setTimeout, this just stops animation if it somehow overruns
        }
    }

    function stopRecording(targetConceptId, autoStopped = false) {
        console.log('[StopRecord] Mouse up or auto-stop. Attempting to stop for target:', targetConceptId, 'Auto-stopped:', autoStopped, 'MediaRecorder state:', mediaRecorder ? mediaRecorder.state : 'null');
        
        // Note: onstop will handle re-enabling replay buttons, as that's when recording *actually* finishes processing.
        // Disabling here might be too early if onstop takes a moment.

        if (maxRecordTimer) {
            clearTimeout(maxRecordTimer);
            maxRecordTimer = null;
            console.log('[StopRecord] Max record timer cleared.');
        }
        // Cancel animation frame before stopping media recorder, as onstop will also try to cancel it.
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            console.log('[StopRecord] Animation frame cleared.');
        }

        const recordBtn = (currentTargetInputId === 'user-answer-text' || targetConceptId === 'user-answer-text') ? recordAnswerButton : recordFollowUpButton;
        // Resetting style immediately on mouse up / auto stop for responsiveness
        // onstop will also do this, but this makes UI feel quicker
        if (recordBtn) {
            const slider = recordBtn.querySelector('.record-progress-slider');
            const buttonText = recordBtn.querySelector('.button-text');
            recordBtn.classList.remove('bg-red-600', 'p-4', 'text-lg');
            recordBtn.classList.add('bg-green-500', 'hover:bg-green-600', 'py-2', 'px-4');
            if (slider) {
                // Keep slider full if auto-stopped at max time, otherwise clear for early stop
                slider.style.width = autoStopped ? '100%' : '0%'; 
            }
            // Text update will be handled by onstop or later transcription logic
            // to avoid race conditions on what the text should be (e.g. "Transcribing...")
        }

        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop(); 
            console.log('[StopRecord] mediaRecorder.stop() called. State should transition to inactive soon.');
            if (recordBtn && recordBtn.querySelector('.button-text').textContent.includes("Recording")) {
                const buttonText = recordBtn.querySelector('.button-text');
                if (buttonText) buttonText.textContent = "Hold to Record Answer";
             }
        } else if (mediaRecorder && mediaRecorder.state === "inactive") {
            console.log('[StopRecord] MediaRecorder already inactive. onstop should have handled UI/transcription.');
        } else {
            console.log('[StopRecord] MediaRecorder not active or null. State:', mediaRecorder ? mediaRecorder.state : 'null', 'Resetting UI manually if needed.');
            const recordBtn = (targetConceptId === 'user-answer-text') ? recordAnswerButton : recordFollowUpButton;
            
            if (recordBtn) {
                recordBtn.textContent = recordBtn.id === 'record-answer-button' ? "Hold to Record Answer" : "Hold to Record Follow-up";
                recordBtn.disabled = false;
            }
            if (targetConceptId === 'follow-up-question-text') {
                const targetInputElement = document.getElementById(targetConceptId);
                 if(targetInputElement) {
                    if (targetInputElement.placeholder === "Transcribing...") {
                         targetInputElement.placeholder = targetInputElement.dataset.originalPlaceholder || "Type or speak your answer";
                    }
                    targetInputElement.disabled = false;
                }
                if(submitFollowUpButton) submitFollowUpButton.disabled = false;
            } else if (targetConceptId === 'user-answer-text') {
                if (recordBtn && recordBtn.textContent.includes("Recording")) {
                    recordBtn.textContent = "Hold to Record Answer";
                 }
            }

            if (mediaRecorder && mediaRecorder.stream) {
                mediaRecorder.stream.getTracks().forEach(track => track.stop());
                console.log('[StopRecord] Manually stopped stream tracks because MediaRecorder was not in a recording state to trigger onstop properly.');
            }
        }
    }

    async function sendAudioForTranscription(audioBlob, targetConceptId) {
        console.log('[Transcription] Preparing to send audio. Target:', targetConceptId, 'Blob size:', audioBlob.size);
        const formData = new FormData();
        formData.append('audio_data', audioBlob, 'recorded_audio.webm');

        const recordBtn = (targetConceptId === 'user-answer-text') ? recordAnswerButton : recordFollowUpButton;
        const buttonText = recordBtn ? recordBtn.querySelector('.button-text') : null;
        let targetInputElement = null;
        let originalPlaceholder = "Type or speak your answer";

        if (targetConceptId === 'user-answer-text') {
            if (buttonText) buttonText.textContent = "Transcribing...";
        } else {
            targetInputElement = document.getElementById(targetConceptId);
            if (targetInputElement && !targetInputElement.dataset.originalPlaceholder) {
                targetInputElement.dataset.originalPlaceholder = targetInputElement.placeholder;
            }
            originalPlaceholder = targetInputElement ? targetInputElement.dataset.originalPlaceholder : originalPlaceholder;
            if (targetInputElement) {
                targetInputElement.placeholder = "Transcribing...";
                targetInputElement.disabled = true;
            }
        }
        if (recordBtn) recordBtn.disabled = true;

        try {
            console.log('[Transcription] Sending POST request to /api/transcribe_audio');
            const response = await fetch('/api/transcribe_audio', {
                method: 'POST',
                body: formData
            });
            console.log('[Transcription] Received response. Status:', response.status);
            if (!response.ok) {
                const errData = await response.json();
                console.error('[Transcription] HTTP error! Status:', response.status, 'Error:', errData.error);
                throw new Error(errData.error || `HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('[Transcription] Success. Transcript:', data.transcript);

            if (targetConceptId === 'user-answer-text') {
                if (data.transcript && data.transcript.trim() !== "") {
                    console.log('[Transcription] Transcript received for answer, proceeding to evaluation.');
                    evaluateTranscribedAnswer(data.transcript);
                } else {
                    alert("Audio not recognized or empty. Please try recording your answer again.");
                    if (recordBtn) {
                        const buttonText = recordBtn.querySelector('.button-text');
                        if (buttonText) buttonText.textContent = "Hold to Record Answer";
                        recordBtn.disabled = false;
                    }
                }
            } else {
                if (targetInputElement) {
                    targetInputElement.value = data.transcript;
                }
            }
        } catch (error) {
            console.error('[Transcription] Error during transcription process:', error);
            alert(`Error transcribing audio: ${error.message}`);
            if (targetConceptId === 'user-answer-text' && recordBtn) {
                 const buttonText = recordBtn.querySelector('.button-text');
                 if (buttonText) buttonText.textContent = "Hold to Record Answer";
            }
        } finally {
            console.log('[Transcription] Finally block. Resetting UI for target:', targetConceptId);
            if (targetConceptId === 'follow-up-question-text') {
                if (targetInputElement) {
                    targetInputElement.placeholder = originalPlaceholder;
                    targetInputElement.disabled = false;
                }
                if (recordBtn) {
                    const textElem = recordBtn.querySelector('.button-text');
                    if (textElem) textElem.textContent = "Hold to Record Follow-up";
                    recordBtn.disabled = false;
                    recordBtn.classList.remove('bg-red-600', 'p-4', 'text-lg');
                    recordBtn.classList.add('bg-green-500', 'hover:bg-green-600', 'py-2', 'px-4');
                    const slider = recordBtn.querySelector('.record-progress-slider');
                    if (slider) slider.style.width = '0%';
                }
                if (submitFollowUpButton) submitFollowUpButton.disabled = false;
            } else if (targetConceptId === 'user-answer-text') {
                // This state is mostly handled by mediaRecorder.onstop or the catch block in transcription
                // but ensure the button text is correct if it was stuck on "Transcribing..."
                if (recordBtn && buttonText && buttonText.textContent === "Transcribing..." && recordBtn.disabled) {
                    buttonText.textContent = "Hold to Record Answer";
                    recordBtn.disabled = false;
                    recordBtn.classList.remove('bg-red-600', 'p-4', 'text-lg');
                    recordBtn.classList.add('bg-green-500', 'hover:bg-green-600', 'py-2', 'px-4');
                    const slider = recordBtn.querySelector('.record-progress-slider');
                    if (slider) slider.style.width = '0%';
                }
            }
        }
    }

    function setupHoldToRecordButton(button) {
        if (!button) return;
        const targetConceptId = button.dataset.targetInput; 

        button.addEventListener('mousedown', (event) => {
            if (event.button === 0) { 
                event.preventDefault(); 
                startRecording(targetConceptId);
            }
        });
        button.addEventListener('touchstart', (event) => {
            event.preventDefault(); 
            startRecording(targetConceptId);
        });

        const stopHandler = (event) => {
            event.preventDefault(); 
            if (mediaRecorder && mediaRecorder.state === "recording") {
                stopRecording(targetConceptId);
            }
        };

        button.addEventListener('mouseup', stopHandler);
        button.addEventListener('mouseleave', stopHandler); 
        button.addEventListener('touchend', stopHandler);
        button.addEventListener('touchcancel', stopHandler); 
    }

    setupHoldToRecordButton(recordAnswerButton);
    setupHoldToRecordButton(recordFollowUpButton);
    
    // Tailwind classes for category buttons
    const categoryButtonBaseClass = 'py-2 px-4 rounded-lg font-semibold transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2';
    const categoryButtonUnselectedClass = 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-400';
    const categoryButtonSelectedClass = 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500';

    fetch('/api/categories')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(categories => {
            categoriesListDiv.innerHTML = ''; 
            if (categories && categories.length > 0) {
                categories.forEach(category => {
                    const button = document.createElement('button');
                    button.textContent = category;
                    button.dataset.category = category;
                    button.className = `${categoryButtonBaseClass} ${categoryButtonUnselectedClass}`;
                    button.type = 'button'; // Important to prevent form submission if it were in a form

                    button.addEventListener('click', () => {
                        // Toggle selection state
                        const isSelected = button.classList.contains(categoryButtonSelectedClass.split(' ')[0]); // Check one distinct class
                        if (isSelected) {
                            button.className = `${categoryButtonBaseClass} ${categoryButtonUnselectedClass}`;
                            // Remove from selectedCategories array if you're maintaining it dynamically
                            // For now, we'll just read it at submission time
                        } else {
                            button.className = `${categoryButtonBaseClass} ${categoryButtonSelectedClass}`;
                        }
                    });
                    categoriesListDiv.appendChild(button);
                });
            } else {
                categoriesListDiv.innerHTML = '<p class="text-gray-500">No categories found or error loading categories.</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching categories:', error);
            categoriesListDiv.innerHTML = '<p class="text-red-500">Error loading categories. Please try again later.</p>';
        });

    startButton.addEventListener('click', function() {
        selectedCategories = [];
        const categoryButtons = document.querySelectorAll('#categories-list button');
        categoryButtons.forEach(button => {
            if (button.classList.contains(categoryButtonSelectedClass.split(' ')[0])) { // Check one distinct class
                selectedCategories.push(button.dataset.category);
            }
        });

        if (selectedCategories.length === 0) {
            alert('Please select at least one category.');
            return;
        }

        startNewProblem();
    });

    function startNewProblem() {
        console.log('[UI] startNewProblem called');
        startButton.disabled = true;
        startButton.style.display = 'none';
        homeButton.style.display = 'block'; // Show home button when problem starts
        problemArea.style.display = 'none';
        feedbackArea.style.display = 'none';
        nextQuestionButton.style.display = 'none';
        followUpButton.style.display = 'none';
        followUpInputArea.style.display = 'none';
        replayQuestionAudioButton.style.display = 'none';
        replayContextualAudioButton.style.display = 'none';
        if (recordAnswerButton) recordAnswerButton.disabled = true;

        fetch('/api/start_problem', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ categories: selectedCategories })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || `HTTP error! status: ${response.status}`) });
            }
            return response.json();
        })
        .then(data => {
            console.log('[UI] Problem data received:', data);
            currentProblem = data; 
            questionTextElem.textContent = data.formatted_question;
            questionAudioElem.src = data.audio_path;
            
            problemArea.style.display = 'block';
            replayQuestionAudioButton.style.display = 'inline-block';
            replayQuestionAudioButton.disabled = true; // Disabled until it can play
            replayContextualAudioButton.style.display = 'none';
            
            questionAudioElem.oncanplaythrough = () => {
                console.log('[UI] Question audio can play through.');
                questionAudioElem.play();
            };
            questionAudioElem.onplay = () => {
                console.log('[UI] Question audio playing.');
                replayQuestionAudioButton.disabled = true;
                replayContextualAudioButton.disabled = true; // General safety
                recordAnswerButton.disabled = true;
            };
            questionAudioElem.onended = () => {
                console.log('[UI] Question audio ended. Enabling answer input and replay.');
                if(recordAnswerButton) recordAnswerButton.disabled = false;
                replayQuestionAudioButton.disabled = false;
            };
            questionAudioElem.onerror = () => {
                console.error('[UI] Error playing question audio.');
                alert('Error playing question audio. You can still read the question.');
                if(recordAnswerButton) recordAnswerButton.disabled = false;
                replayQuestionAudioButton.disabled = false; // Allow retry if source is valid
            };

            document.getElementById('category-selection').style.display = 'none';
            startButton.textContent = 'Processing...';
            startButton.style.display = 'none';
            recordAnswerButton.disabled = true;

        })
        .catch(error => {
            console.error('[UI] Error starting problem:', error);
            alert(`Error starting problem: ${error.message}`);
            startButton.disabled = false;
            startButton.style.display = 'inline-block';
            document.getElementById('category-selection').style.display = 'block';
            if (recordAnswerButton) recordAnswerButton.disabled = false; 
        });
    }

    function evaluateTranscribedAnswer(userAnswer) {
        console.log('[UI] Evaluating transcribed answer:', userAnswer);
        if (!userAnswer || userAnswer.trim() === "") {
            alert('Cannot submit empty answer.');
            if(recordAnswerButton) {
                const buttonText = recordAnswerButton.querySelector('.button-text');
                if (buttonText) buttonText.textContent = "Hold to Record Answer";
                recordAnswerButton.disabled = false;
            }
            return;
        }
        if (!currentProblem || !currentProblem.original_question || !currentProblem.original_answer) {
            alert('Error: No current problem data found. Please start a new problem.');
            if(recordAnswerButton) {
                const buttonText = recordAnswerButton.querySelector('.button-text');
                if (buttonText) buttonText.textContent = "Hold to Record Answer";
                recordAnswerButton.disabled = false;
            }
            return;
        }

        if(recordAnswerButton) {
            const buttonText = recordAnswerButton.querySelector('.button-text');
            buttonText.textContent = "Evaluating...";
            recordAnswerButton.disabled = true;
        }

        fetch('/api/evaluate_answer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                original_question: currentProblem.original_question,
                original_answer: currentProblem.original_answer,
                user_answer: userAnswer
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || `HTTP error! status: ${response.status}`) });
            }
            return response.json();
        })
        .then(feedback => {
            console.log('[UI] Feedback received:', feedback);
            problemArea.style.display = 'none'; 
            feedbackArea.style.display = 'block';
            
            replayQuestionAudioButton.style.display = 'none'; // Hide question replay

            if (feedback.is_correct) {
                feedbackTextElem.textContent = '✓ Correct!';
                feedbackTextElem.style.color = 'green';
                correctAnswerTextElem.textContent = '';
                explanationTextElem.textContent = feedback.explanation || '';
                followUpButton.style.display = 'none';
                if(recordFollowUpButton) recordFollowUpButton.disabled = true;
                nextQuestionButton.style.display = 'inline-block'; 
                replayContextualAudioButton.style.display = 'none'; // No audio for correct answer explanation yet
            } else {
                feedbackTextElem.textContent = '✗ Incorrect!';
                feedbackTextElem.style.color = 'red';
                correctAnswerTextElem.textContent = `The correct answer is: ${currentProblem.original_answer}`;
                explanationTextElem.textContent = feedback.explanation || 'No explanation provided.';
                followUpButton.style.display = 'inline-block'; 
                if(recordFollowUpButton) recordFollowUpButton.disabled = false;
                nextQuestionButton.style.display = 'inline-block'; 
                replayContextualAudioButton.style.display = 'none'; // Default to none, show if audio exists

                if (feedback.explanation_audio_path) {
                    questionAudioElem.src = feedback.explanation_audio_path;
                    replayContextualAudioButton.style.display = 'inline-block';
                    replayContextualAudioButton.textContent = "Replay Explanation";
                    replayContextualAudioButton.disabled = true; // Disabled until it can play

                    questionAudioElem.oncanplaythrough = () => {
                        console.log('[UI] Explanation audio can play through.');
                        questionAudioElem.play();
                    };
                    // onplay, onended, onerror for questionAudioElem will be rebound here
                    questionAudioElem.onplay = () => {
                        console.log('[UI] Explanation audio playing.');
                        replayContextualAudioButton.disabled = true;
                        nextQuestionButton.disabled = true;
                        followUpButton.disabled = true;
                        if(recordFollowUpButton) recordFollowUpButton.disabled = true;
                    };
                    questionAudioElem.onended = () => {
                        console.log('[UI] Explanation audio ended.');
                        nextQuestionButton.disabled = false;
                        followUpButton.disabled = false;
                        if(recordFollowUpButton) recordFollowUpButton.disabled = false;
                        replayContextualAudioButton.disabled = false;
                    };
                    questionAudioElem.onerror = () => {
                        console.error('[UI] Error playing explanation audio.');
                        alert('Error playing explanation audio. You can read the explanation.');
                        nextQuestionButton.disabled = false;
                        followUpButton.disabled = false;
                        if(recordFollowUpButton) recordFollowUpButton.disabled = false;
                        replayContextualAudioButton.disabled = false;
                    };
                } else {
                    nextQuestionButton.disabled = false;
                    followUpButton.disabled = false;
                    if(recordFollowUpButton) recordFollowUpButton.disabled = false;
                    replayContextualAudioButton.style.display = 'none';
                }
            }
            if (recordAnswerButton) {
                const buttonText = recordAnswerButton.querySelector('.button-text');
                if (buttonText) buttonText.textContent = "Hold to Record Answer";
            }
            nextQuestionButton.focus();                                        

        })
        .catch(error => {
            console.error('[UI] Error evaluating answer:', error);
            alert(`Error evaluating answer: ${error.message}`);
            if(recordAnswerButton) {
                const buttonText = recordAnswerButton.querySelector('.button-text');
                if (buttonText) buttonText.textContent = "Hold to Record Answer";
                recordAnswerButton.disabled = false;
            }
        });
    }

    nextQuestionButton.addEventListener('click', function() {
        console.log('[UI] Next Question button clicked.');
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            console.log('[UI] Next Question: Recording active, determining which to stop.');
            if(recordAnswerButton.querySelector('.button-text').textContent.includes("Recording") || recordAnswerButton.querySelector('.button-text').textContent.includes("Transcribing") || recordAnswerButton.querySelector('.button-text').textContent.includes("Evaluating")){
                stopRecording('user-answer-text');
            } else if(recordFollowUpButton.querySelector('.button-text').textContent.includes("Recording")){
                stopRecording(followUpQuestionTextElem.id);
            }
        }

        feedbackArea.style.display = 'none';
        followUpInputArea.style.display = 'none';
        nextQuestionButton.style.display = 'none';
        followUpButton.style.display = 'none';
        replayQuestionAudioButton.style.display = 'none';
        replayContextualAudioButton.style.display = 'none';
        if(recordFollowUpButton) recordFollowUpButton.disabled = true;
        
        if (selectedCategories.length > 0) {
            startNewProblem(); 
        } else {
            alert("No categories selected. Please refresh and select categories.");
            document.getElementById('category-selection').style.display = 'block';
            startButton.textContent = 'Start Study Session';
            startButton.style.display = 'inline-block';
            startButton.disabled = false;
        }
    });

    followUpButton.addEventListener('click', function() {
        console.log('[UI] Follow-up button clicked.');
        followUpInputArea.style.display = 'block';
        followUpQuestionTextElem.value = '';
        followUpQuestionTextElem.focus();
        followUpButton.style.display = 'none'; 
        if(recordFollowUpButton) recordFollowUpButton.disabled = false;
    });

    submitFollowUpButton.addEventListener('click', function() {
        console.log('[UI] Submit Follow-up button clicked.');
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            console.log('[UI] Submit Follow-up: Recording active, stopping it first.');
            stopRecording(followUpQuestionTextElem.id);
        }

        const followUpQuestion = followUpQuestionTextElem.value.trim();
        if (!followUpQuestion) {
            alert('Please enter your follow-up question.');
            return;
        }
        if (!currentProblem || !currentProblem.original_question || !currentProblem.original_answer) {
            alert('Error: No current problem data for follow-up. Please start a new problem.');
            return;
        }

        submitFollowUpButton.disabled = true;
        followUpQuestionTextElem.disabled = true;
        if(recordFollowUpButton) recordFollowUpButton.disabled = true;

        fetch('/api/follow_up', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                original_question: currentProblem.original_question,
                original_answer: currentProblem.original_answer,
                follow_up_question: followUpQuestion
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || `HTTP error! status: ${response.status}`) });
            }
            return response.json();
        })
        .then(data => {
            console.log('[UI] Follow-up response received:', data);
            explanationTextElem.innerHTML = `<strong>Follow-up Response:</strong><br>${data.follow_up_response}`;
            questionAudioElem.src = data.audio_path; 
            replayQuestionAudioButton.style.display = 'none';
            replayContextualAudioButton.style.display = 'inline-block';
            replayContextualAudioButton.textContent = "Replay Response";
            replayContextualAudioButton.disabled = true;
            
            questionAudioElem.oncanplaythrough = () => {
                console.log('[UI] Follow-up audio can play through.');
                questionAudioElem.play();
            };
            // onplay, onended, onerror for questionAudioElem will be rebound here
            questionAudioElem.onplay = () => {
                console.log('[UI] Follow-up audio playing.');
                replayContextualAudioButton.disabled = true;
                nextQuestionButton.disabled = true;
            };
            questionAudioElem.onended = () => {
                console.log('[UI] Follow-up audio ended.');
                nextQuestionButton.disabled = false;
                nextQuestionButton.focus();
                followUpInputArea.style.display = 'none'; 
                replayContextualAudioButton.disabled = false;
            };
            questionAudioElem.onerror = () => {
                console.error('[UI] Error playing follow-up audio.');
                alert('Error playing follow-up audio. You can read the response.');
                nextQuestionButton.disabled = false;
                nextQuestionButton.focus();
                followUpInputArea.style.display = 'none';
                replayContextualAudioButton.disabled = false;
            };
        })
        .catch(error => {
            console.error('[UI] Error getting follow-up:', error);
            alert(`Error getting follow-up: ${error.message}`);
            submitFollowUpButton.disabled = false;
            followUpQuestionTextElem.disabled = false;
            if(recordFollowUpButton) recordFollowUpButton.disabled = false;
        });
    });

    replayQuestionAudioButton.addEventListener('click', () => {
        if (questionAudioElem.src && problemArea.style.display === 'block') {
            questionAudioElem.play();
        }
    });

    replayContextualAudioButton.addEventListener('click', () => {
        if (questionAudioElem.src && feedbackArea.style.display === 'block') {
            questionAudioElem.play();
        }
    });

    homeButton.addEventListener('click', function() {
        console.log('[UI] Home button clicked.');

        // Stop any active media recording
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            const activeRecordButtonText = recordAnswerButton.querySelector('.button-text').textContent;
            const activeFollowUpButtonText = recordFollowUpButton.querySelector('.button-text').textContent;

            if (activeRecordButtonText.includes("Recording") || activeRecordButtonText.includes("Transcribing") || activeRecordButtonText.includes("Evaluating")) {
                stopRecording('user-answer-text');
            } else if (activeFollowUpButtonText.includes("Recording")) {
                stopRecording(followUpQuestionTextElem.id);
            }
        }

        // Stop any playing audio
        if (!questionAudioElem.paused) {
            questionAudioElem.pause();
            questionAudioElem.currentTime = 0;
        }

        // Hide problem/feedback areas
        problemArea.style.display = 'none';
        feedbackArea.style.display = 'none';
        followUpInputArea.style.display = 'none';
        nextQuestionButton.style.display = 'none';
        replayQuestionAudioButton.style.display = 'none';
        replayContextualAudioButton.style.display = 'none';

        // Show category selection
        document.getElementById('category-selection').style.display = 'block';
        
        // Reset and show start button
        startButton.textContent = 'Start Study Session';
        startButton.disabled = false;
        startButton.style.display = 'inline-block';

        // Hide home button itself
        homeButton.style.display = 'none';

        // Reset record button states
        const answerButtonText = recordAnswerButton.querySelector('.button-text');
        if (answerButtonText) answerButtonText.textContent = "Hold to Record Answer";
        recordAnswerButton.disabled = true; // Should be disabled until question audio ends
        recordAnswerButton.classList.remove('bg-red-600', 'p-4', 'text-lg');
        recordAnswerButton.classList.add('bg-green-500', 'hover:bg-green-600', 'py-2', 'px-4');
        const answerSlider = recordAnswerButton.querySelector('.record-progress-slider');
        if (answerSlider) answerSlider.style.width = '0%';

        const followUpRecButtonText = recordFollowUpButton.querySelector('.button-text');
        if (followUpRecButtonText) followUpRecButtonText.textContent = "Hold to Record Follow-up";
        recordFollowUpButton.disabled = true;
        recordFollowUpButton.classList.remove('bg-red-600', 'p-4', 'text-lg');
        recordFollowUpButton.classList.add('bg-green-500', 'hover:bg-green-600', 'py-2', 'px-4');
        const followUpSlider = recordFollowUpButton.querySelector('.record-progress-slider');
        if (followUpSlider) followUpSlider.style.width = '0%';
        
        followUpQuestionTextElem.value = '';
        submitFollowUpButton.disabled = false;

        currentProblem = null; 
        // selectedCategories = []; // Let user keep their selections or deselect manually
        console.log('[UI] Returned to category selection.');
    });

    // Info Popup Logic
    if (!sessionStorage.getItem('infoPopupShown')) {
        if (infoPopupOverlay) {
            infoPopupOverlay.style.display = 'flex'; // Use flex to center the modal
        }
    }

    if (infoPopupCloseButton) {
        infoPopupCloseButton.addEventListener('click', () => {
            if (infoPopupOverlay) {
                infoPopupOverlay.style.display = 'none';
            }
            sessionStorage.setItem('infoPopupShown', 'true');
        });
    }

    // Optional: Close modal if overlay is clicked (but not the modal content itself)
    if (infoPopupOverlay) {
        infoPopupOverlay.addEventListener('click', function(event) {
            if (event.target === infoPopupOverlay) { // Only if overlay itself is clicked
                infoPopupOverlay.style.display = 'none';
                sessionStorage.setItem('infoPopupShown', 'true');
            }
        });
    }
}); 