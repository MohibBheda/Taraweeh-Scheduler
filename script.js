document.getElementById('number-of-imams').addEventListener('change', function() {
    const numImams = parseInt(this.value, 10);
    createImamInputs(numImams);
});

function createImamInputs(numImams) {
    const container = document.getElementById('imam-inputs');
    container.innerHTML = ''; // Clear previous inputs

    for (let i = 1; i <= numImams; i++) {
        const div = document.createElement('div');
        div.className = 'imam-input';

        const label = document.createElement('label');
        label.textContent = `Imam ${i}:`;

        const select = document.createElement('select');
        for (let j = 2; j <= 20; j += 2) { // Example options
            const option = document.createElement('option');
            option.value = j;
            option.textContent = `${j} Rak'ah`;
            select.appendChild(option);
        }

        div.appendChild(label);
        div.appendChild(select);
        container.appendChild(div);
    }
}

document.getElementById('generate-schedule').addEventListener('click', function() {
    const rakahPerNight = parseInt(document.getElementById('rakah-per-night').value, 10);
    const numberOfImams = parseInt(document.getElementById('number-of-imams').value, 10);
    const inputs = document.querySelectorAll('#imam-inputs select');

    let rakahPerImam = [];
    inputs.forEach(input => {
        rakahPerImam.push(parseInt(input.value, 10));
    });

    // Ensure rakahPerImam array sums to rakahPerNight
    const sum = rakahPerImam.reduce((a, b) => a + b, 0);
    if (sum !== rakahPerNight) {
        alert('The total Rak\'ah per imam do not add up to the total Rak\'ah per night.');
        return;
    }

    // Example: Calculate and display the schedule
    const scheduleOutput = document.getElementById('schedule-output');
    scheduleOutput.innerHTML = ''; // Clear previous output

    rakahPerImam.forEach((rakah, index) => {
        const p = document.createElement('p');
        p.textContent = `Imam ${index + 1}: ${rakah} Rak'ah`;
        scheduleOutput.appendChild(p);
    });
});
// Example list of recommended stopping points
const recommendedStoppingPoints = [2, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 114];
function adjustScheduleForStoppingPoints(schedule) {
    // Example logic to adjust schedule based on stopping points
    let adjustedSchedule = [];
    let currentVerse = 1;

    schedule.forEach(rakah => {
        let endVerse = currentVerse + rakah - 1;
        
        // Find the closest recommended stopping point before or at endVerse
        const stopPoint = recommendedStoppingPoints.reverse().find(point => point <= endVerse);
        if (stopPoint) {
            adjustedSchedule.push({ start: currentVerse, end: stopPoint });
            currentVerse = stopPoint + 1;
        } else {
            adjustedSchedule.push({ start: currentVerse, end: endVerse });
            currentVerse = endVerse + 1;
        }
    });

    return adjustedSchedule;
}

document.getElementById('generate-schedule').addEventListener('click', function() {
    const rakahPerNight = parseInt(document.getElementById('rakah-per-night').value, 10);
    const numberOfImams = parseInt(document.getElementById('number-of-imams').value, 10);
    const inputs = document.querySelectorAll('#imam-inputs select');

    let rakahPerImam = [];
    inputs.forEach(input => {
        rakahPerImam.push(parseInt(input.value, 10));
    });

    // Ensure rakahPerImam array sums to rakahPerNight
    const sum = rakahPerImam.reduce((a, b) => a + b, 0);
    if (sum !== rakahPerNight) {
        alert('The total Rak\'ah per imam do not add up to the total Rak\'ah per night.');
        return;
    }

    // Calculate and adjust the schedule
    const adjustedSchedule = adjustScheduleForStoppingPoints(rakahPerImam);

    // Display the adjusted schedule
    const scheduleOutput = document.getElementById('schedule-output');
    scheduleOutput.innerHTML = ''; // Clear previous output

    adjustedSchedule.forEach((session, index) => {
        const p = document.createElement('p');
        p.textContent = `Imam ${index + 1}: From verse ${session.start} to ${session.end}`;
        scheduleOutput.appendChild(p);
    });
});
// Example structure: Array of Juz with Surahs and Verses
const quranStructure = [
    { juz: 1, surahs: [{ number: 1, verses: 7 }, { number: 2, verses: 141 }] },
    { juz: 2, surahs: [{ number: 2, verses: 141 }, { number: 3, verses: 200 }] },
    // Add all other Juz here
];
function getJuzSurahVerse(verseNumber) {
    for (const juz of quranStructure) {
        for (const surah of juz.surahs) {
            if (verseNumber <= surah.verses) {
                return {
                    juz: juz.juz,
                    surah: surah.number,
                    verse: verseNumber
                };
            }
            verseNumber -= surah.verses;
        }
    }
    return null; // If no match found
}

function displaySchedule(schedule) {
    const scheduleOutput = document.getElementById('schedule-output');
    scheduleOutput.innerHTML = ''; // Clear previous output

    schedule.forEach((session, index) => {
        const startDetails = getJuzSurahVerse(session.start);
        const endDetails = getJuzSurahVerse(session.end);

        const p = document.createElement('p');
        p.textContent = `Imam ${index + 1}: From Juz ${startDetails.juz}, Surah ${startDetails.surah}, Verse ${session.start} to Juz ${endDetails.juz}, Surah ${endDetails.surah}, Verse ${session.end}`;
        scheduleOutput.appendChild(p);
    });
}

document.getElementById('generate-schedule').addEventListener('click', function() {
    // Existing code to generate schedule

    // After generating the schedule
    const adjustedSchedule = adjustScheduleForStoppingPoints(rakahPerImam);
    displaySchedule(adjustedSchedule);
});
