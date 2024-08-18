let stoppingPoints = [];

// Handle file input and parse CSV data
document.getElementById('fileInput').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const csvText = e.target.result;
            stoppingPoints = parseCSV(csvText);
        };
        reader.readAsText(file);
    }
});

function parseCSV(data) {
    const rows = data.split('\n');
    const result = [];
    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(',');
        if (cols.length >= 3) {
            result.push({
                juz: parseInt(cols[0].trim()),
                surah: parseInt(cols[1].trim()),
                verse: parseInt(cols[2].trim())
            });
        }
    }
    return result;
}

function updateImamInputs() {
    const numberOfImams = parseInt(document.getElementById('number-of-imams').value);
    const imamInputsDiv = document.getElementById('imam-inputs');
    imamInputsDiv.innerHTML = ''; // Clear previous inputs

    const unitsPerNight = parseInt(document.getElementById('units-per-night').value);

    for (let i = 1; i <= numberOfImams; i++) {
        const label = document.createElement('label');
        label.textContent = `Rak'ah for Imam ${i}:`;

        const select = document.createElement('select');
        select.id = `imam-${i}-units`;

        // Populate options for Rak'ah
        for (let j = 2; j <= unitsPerNight; j += 2) {
            const option = document.createElement('option');
            option.value = j;
            option.textContent = `${j} Rak'ah`;
            select.appendChild(option);
        }

        imamInputsDiv.appendChild(label);
        imamInputsDiv.appendChild(select);
    }
}

function generateSchedule() {
    const unitsPerNight = parseInt(document.getElementById('units-per-night').value);
    const numberOfImams = parseInt(document.getElementById('number-of-imams').value);

    let imams = [];
    for (let i = 1; i <= numberOfImams; i++) {
        const units = parseInt(document.getElementById(`imam-${i}-units`).value);
        imams.push(units);
    }

    if (imams.reduce((a, b) => a + b, 0) !== unitsPerNight) {
        alert('The total Rak\'ah for all imams must equal the units of prayer per night.');
        return;
    }

    const startDate = new Date(document.getElementById('start-date').value);
    const endDate = new Date(document.getElementById('end-date').value);
    const today = new Date();
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        alert('Please select valid start and end dates.');
        return;
    }

    if (endDate <= startDate) {
        alert('The end date must be after the start date.');
        return;
    }

    if (stoppingPoints.length === 0) {
        alert('Please upload a CSV file with stopping points.');
        return;
    }

    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    if (totalDays <= 0) {
        alert('The completion date must be in the future.');
        return;
    }

    const outputDiv = document.getElementById('schedule-output');
    outputDiv.innerHTML = ''; // Clear previous output

    const nightsPerImam = imams.map(units => units / 2); // Number of nights each imam will lead
    const totalNights = nightsPerImam.reduce((a, b) => a + b, 0);

    // Ensure that the total number of nights aligns with the total days available
    if (totalNights > totalDays) {
        alert('The total number of nights required exceeds the available days to completion.');
        return;
    }

    let currentIndex = 0; // Track the index in the stoppingPoints array
    const nightlySchedule = [];

    for (let night = 0; night < totalDays; night++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + night);

        let nightSchedule = `<tr><td>${date.toDateString()}</td>`;
        let nightImamSchedules = [];

        imams.forEach((units, index) => {
            const startIndex = currentIndex;
            currentIndex += units / 2;

            if (startIndex < stoppingPoints.length && currentIndex <= stoppingPoints.length) {
                const start = stoppingPoints[startIndex];
                const end = stoppingPoints[currentIndex - 1];
                nightImamSchedules.push(`<td>Imam ${index + 1}: Juz ${start.juz}, Surah ${start.surah}, Verse ${start.verse} to Juz ${end.juz}, Surah ${end.surah}, Verse ${end.verse}</td>`);
            } else {
                nightImamSchedules.push(`<td>Imam ${index + 1}: Not enough data to complete the schedule.</td>`);
            }
        });

        nightSchedule += nightImamSchedules.join('') + '</tr>';
        nightlySchedule.push(nightSchedule);
    }

    outputDiv.innerHTML = `<table class="calendar">
        <thead>
            <tr>
                <th>Date</th>
                ${imams.map((_, index) => `<th>Imam ${index + 1}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${nightlySchedule.join('')}
        </tbody>
    </table>`;
}
