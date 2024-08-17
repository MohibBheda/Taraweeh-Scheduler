document.addEventListener('DOMContentLoaded', () => {
    const numberOfImamsSelect = document.getElementById('number-of-imams');
    const unitsPerNightSelect = document.getElementById('units-per-night');
    const imamInputsDiv = document.getElementById('imam-inputs');
    const generateButton = document.getElementById('generate-button');
    const scheduleOutput = document.getElementById('schedule-output');

    const versesData = [
        // This should be a detailed list of verses mapping with Surah and Juz.
        // For simplicity, this is an example and should be replaced with actual data.
        { juz: 1, surah: 1, startVerse: 1, endVerse: 7 },
        { juz: 1, surah: 2, startVerse: 1, endVerse: 141 },
        // Add more data here for all Surahs and Juz.
        // Ensure each entry covers start and end verses accurately.
    ];

    function updateImamInputs() {
        const numberOfImams = parseInt(numberOfImamsSelect.value, 10);
        imamInputsDiv.innerHTML = '';
        if (numberOfImams > 0) {
            for (let i = 0; i < numberOfImams; i++) {
                const label = document.createElement('label');
                label.textContent = `Rak'ah for Imam ${i + 1}:`;
                const select = document.createElement('select');
                for (let j = 2; j <= 20; j += 2) { // Even numbers only
                    const option = document.createElement('option');
                    option.value = j;
                    option.textContent = j;
                    select.appendChild(option);
                }
                label.appendChild(select);
                imamInputsDiv.appendChild(label);
            }
            // Make the imam inputs visible
            imamInputsDiv.style.display = 'block';
        } else {
            // Hide the imam inputs if no imams are selected
            imamInputsDiv.style.display = 'none';
        }
    }

    function generateSchedule() {
        const unitsPerNight = parseInt(unitsPerNightSelect.value, 10);
        const numberOfImams = parseInt(numberOfImamsSelect.value, 10);
        const imamUnits = Array.from(imamInputsDiv.querySelectorAll('select'))
            .map(select => parseInt(select.value, 10));

        const totalUnits = imamUnits.reduce((acc, units) => acc + units, 0);

        if (totalUnits !== unitsPerNight) {
            scheduleOutput.textContent = `The total Rak'ahs (${totalUnits}) do not match the required Rak'ahs per night (${unitsPerNight}).`;
            return;
        }

        let scheduleHtml = '';
        let verseIndex = 0;

        for (let i = 0; i < numberOfImams; i++) {
            let startVerse = verseIndex + 1;
            let endVerse = startVerse + imamUnits[i] - 1;

            // Find the appropriate Juz and Surah based on the verses
            let juzNumber = 0;
            let surahNumber = 0;

            for (const verse of versesData) {
                if (startVerse >= verse.startVerse && endVerse <= verse.endVerse) {
                    juzNumber = verse.juz;
                    surahNumber = verse.surah;
                    break;
                }
            }

            scheduleHtml += `Imam ${i + 1}: Juz ${juzNumber}, Surah ${surahNumber}, From verse ${startVerse} to ${endVerse}<br>`;
            verseIndex = endVerse; // Move to the next verse for the following Imam
        }

        scheduleOutput.innerHTML = scheduleHtml;
    }

    numberOfImamsSelect.addEventListener('change', updateImamInputs);
    generateButton.addEventListener('click', generateSchedule);

    // Initial setup
    imamInputsDiv.style.display = 'none'; // Hide the imam inputs initially
});
