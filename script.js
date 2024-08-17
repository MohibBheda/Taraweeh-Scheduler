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
