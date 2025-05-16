document.addEventListener('DOMContentLoaded', function() {
    const categoriesListDiv = document.getElementById('categories-list');
    const startButton = document.getElementById('start-button');
    const problemArea = document.getElementById('problem-area');
    const questionTextElem = document.getElementById('question-text');
    const questionAudioElem = document.getElementById('question-audio');
    const userAnswerTextElem = document.getElementById('user-answer-text');
    const submitAnswerButton = document.getElementById('submit-answer-button');
    const feedbackArea = document.getElementById('feedback-area');
    const feedbackTextElem = document.getElementById('feedback-text');
    const correctAnswerTextElem = document.getElementById('correct-answer-text');
    const explanationTextElem = document.getElementById('explanation-text');
    const followUpButton = document.getElementById('follow-up-button');
    const followUpInputArea = document.getElementById('follow-up-input-area');
    const followUpQuestionTextElem = document.getElementById('follow-up-question-text');
    const submitFollowUpButton = document.getElementById('submit-follow-up-button');
    const nextQuestionButton = document.getElementById('next-question-button');

    // Global state for current problem
    let currentProblem = null;
    let selectedCategories = [];

    // Fetch categories on page load
    fetch('/api/categories')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(categories => {
            categoriesListDiv.innerHTML = ''; // Clear loading message
            if (categories && categories.length > 0) {
                categories.forEach(category => {
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = category;
                    checkbox.name = 'category';
                    checkbox.value = category;
                    
                    const label = document.createElement('label');
                    label.htmlFor = category;
                    label.appendChild(document.createTextNode(category));
                    
                    const br = document.createElement('br');
                    
                    categoriesListDiv.appendChild(checkbox);
                    categoriesListDiv.appendChild(label);
                    categoriesListDiv.appendChild(br);
                });
            } else {
                categoriesListDiv.innerHTML = '<p>No categories found or error loading categories.</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching categories:', error);
            categoriesListDiv.innerHTML = '<p>Error loading categories. Please try again later.</p>';
        });

    startButton.addEventListener('click', function() {
        selectedCategories = [];
        const checkboxes = document.querySelectorAll('#categories-list input[name="category"]:checked');
        checkboxes.forEach(checkbox => {
            selectedCategories.push(checkbox.value);
        });

        if (selectedCategories.length === 0) {
            alert('Please select at least one category.');
            return;
        }

        startNewProblem();
    });

    function startNewProblem() {
        startButton.disabled = true;
        problemArea.style.display = 'none';
        feedbackArea.style.display = 'none';
        nextQuestionButton.style.display = 'none';
        followUpButton.style.display = 'none';
        followUpInputArea.style.display = 'none';
        userAnswerTextElem.value = '';

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
            currentProblem = data; // Store for evaluation
            questionTextElem.textContent = data.formatted_question;
            questionAudioElem.src = data.audio_path;
            
            problemArea.style.display = 'block';
            questionAudioElem.style.display = 'block'; // Show audio player, even if just for controls
            
            questionAudioElem.oncanplaythrough = () => {
                questionAudioElem.play();
            };
            questionAudioElem.onended = () => {
                // Enable submit answer mechanisms
                userAnswerTextElem.disabled = false;
                submitAnswerButton.disabled = false;
                // For now, we don't disable start button here, as it becomes "next problem" effectively
                // Or, we re-enable a different button like "submit answer"
                // The big red button (startButton) will be re-enabled by nextQuestionButton or after feedback
            };
            questionAudioElem.onerror = () => {
                console.error('Error playing audio.');
                alert('Error playing question audio. You can still read the question and answer.');
                 // Still enable submit answer mechanisms
                userAnswerTextElem.disabled = false;
                submitAnswerButton.disabled = false;
            };

            // Hide category selection, show problem area
            document.getElementById('category-selection').style.display = 'none';
            startButton.textContent = 'Processing...'; // Or hide it and show a dedicated next button later
            userAnswerTextElem.disabled = true; // Disable until audio finishes
            submitAnswerButton.disabled = true;

        })
        .catch(error => {
            console.error('Error starting problem:', error);
            alert(`Error starting problem: ${error.message}`);
            startButton.disabled = false;
            startButton.textContent = 'Start Study Session';
            document.getElementById('category-selection').style.display = 'block';
        });
    }

    submitAnswerButton.addEventListener('click', function() {
        const userAnswer = userAnswerTextElem.value.trim();
        if (!userAnswer) {
            alert('Please enter your answer.');
            return;
        }
        if (!currentProblem || !currentProblem.original_question || !currentProblem.original_answer) {
            alert('Error: No current problem data found. Please start a new problem.');
            return;
        }

        submitAnswerButton.disabled = true;
        userAnswerTextElem.disabled = true;

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
            problemArea.style.display = 'none'; // Hide question input area
            feedbackArea.style.display = 'block';
            
            if (feedback.is_correct) {
                feedbackTextElem.textContent = '✓ Correct!';
                feedbackTextElem.style.color = 'green';
                correctAnswerTextElem.textContent = '';
                explanationTextElem.textContent = feedback.explanation || '';
                followUpButton.style.display = 'none';
                nextQuestionButton.style.display = 'inline-block'; // Show next question button
            } else {
                feedbackTextElem.textContent = '✗ Incorrect!';
                feedbackTextElem.style.color = 'red';
                correctAnswerTextElem.textContent = `The correct answer is: ${currentProblem.original_answer}`;
                explanationTextElem.textContent = feedback.explanation || 'No explanation provided.';
                followUpButton.style.display = 'inline-block'; // Show follow-up button
                nextQuestionButton.style.display = 'inline-block'; // Also show next question button

                // Play explanation audio if available
                if (feedback.explanation_audio_path) {
                    questionAudioElem.src = feedback.explanation_audio_path;
                    questionAudioElem.style.display = 'block'; // Make sure audio player is visible
                    questionAudioElem.oncanplaythrough = () => {
                        questionAudioElem.play();
                    };
                    questionAudioElem.onended = () => {
                        // Actions after explanation audio finishes, e.g., ensure buttons are enabled
                        nextQuestionButton.disabled = false;
                        followUpButton.disabled = false;
                    };
                    questionAudioElem.onerror = () => {
                        console.error('Error playing explanation audio.');
                        alert('Error playing explanation audio. You can read the explanation.');
                        nextQuestionButton.disabled = false;
                        followUpButton.disabled = false;
                    };
                } else {
                    // No audio explanation, ensure buttons are enabled
                    nextQuestionButton.disabled = false;
                    followUpButton.disabled = false;
                }
            }
            // The main startButton can now be re-labeled or we use a dedicated nextQuestionButton
            startButton.textContent = 'Next Question';
            startButton.disabled = false; // Re-enable the main button for the next question
                                        // OR, rely on nextQuestionButton and keep startButton for initial start.
                                        // Let's use nextQuestionButton and reset startButton for new sessions.
            nextQuestionButton.focus();                                        

        })
        .catch(error => {
            console.error('Error evaluating answer:', error);
            alert(`Error evaluating answer: ${error.message}`);
            submitAnswerButton.disabled = false;
            userAnswerTextElem.disabled = false;
        });
    });

    nextQuestionButton.addEventListener('click', function() {
        feedbackArea.style.display = 'none';
        followUpInputArea.style.display = 'none';
        nextQuestionButton.style.display = 'none';
        followUpButton.style.display = 'none';
        
        // If we want the main start button to truly reset the session (e.g. allow category re-selection)
        // document.getElementById('category-selection').style.display = 'block';
        // startButton.textContent = 'Start Study Session';
        // startButton.disabled = false;
        // problemArea.style.display = 'none';
        // currentProblem = null;

        // For now, just start a new problem with the same categories
        if (selectedCategories.length > 0) {
            startNewProblem(); 
        } else {
            // This case should ideally not be hit if UI flow is right
            alert("No categories selected. Please refresh and select categories.");
            document.getElementById('category-selection').style.display = 'block';
            startButton.textContent = 'Start Study Session';
            startButton.disabled = false;
        }
    });

    followUpButton.addEventListener('click', function() {
        followUpInputArea.style.display = 'block';
        followUpQuestionTextElem.value = '';
        followUpQuestionTextElem.focus();
        followUpButton.style.display = 'none'; // Hide once input is shown
    });

    submitFollowUpButton.addEventListener('click', function() {
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

        // Optionally clear previous follow-up display elements if any
        // e.g., if we add a specific display area for follow-up response text/audio

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
            // Display follow-up response
            // We can reuse some existing elements or add new ones
            // For now, let's update the explanation text and play audio
            explanationTextElem.innerHTML = `<strong>Follow-up Response:</strong><br>${data.follow_up_response}`;
            questionAudioElem.src = data.audio_path; // Reuse question audio element for simplicity
            questionAudioElem.style.display = 'block';
            
            questionAudioElem.oncanplaythrough = () => {
                questionAudioElem.play();
            };
            questionAudioElem.onended = () => {
                // What happens after follow-up audio? Enable next question.
                nextQuestionButton.disabled = false;
                nextQuestionButton.focus();
                submitFollowUpButton.disabled = false;
                followUpQuestionTextElem.disabled = false;
                followUpInputArea.style.display = 'none'; // Hide after successful follow-up
            };
            questionAudioElem.onerror = () => {
                console.error('Error playing follow-up audio.');
                alert('Error playing follow-up audio. You can read the response.');
                nextQuestionButton.disabled = false;
                nextQuestionButton.focus();
                submitFollowUpButton.disabled = false;
                followUpQuestionTextElem.disabled = false;
                followUpInputArea.style.display = 'none';
            };
        })
        .catch(error => {
            console.error('Error getting follow-up:', error);
            alert(`Error getting follow-up: ${error.message}`);
            submitFollowUpButton.disabled = false;
            followUpQuestionTextElem.disabled = false;
        });
    });
}); 