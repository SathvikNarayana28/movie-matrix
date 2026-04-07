function buildShowDateTime(date, time) {
    if (!date || !time) return null;

    const datePart = String(date).split("T")[0];
    const dateMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) return null;

    const timePart = String(time).trim();
    const meridiemMatch = timePart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    const hour24Match = timePart.match(/^(\d{1,2}):(\d{2})$/);

    let hours;
    let minutes;

    if (meridiemMatch) {
        hours = parseInt(meridiemMatch[1], 10);
        minutes = parseInt(meridiemMatch[2], 10);
        const meridiem = meridiemMatch[3].toUpperCase();

        if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;

        if (meridiem === "PM" && hours !== 12) hours += 12;
        if (meridiem === "AM" && hours === 12) hours = 0;
    } else if (hour24Match) {
        hours = parseInt(hour24Match[1], 10);
        minutes = parseInt(hour24Match[2], 10);

        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    } else {
        return null;
    }

    const [, year, month, day] = dateMatch;
    return new Date(Number(year), Number(month) - 1, Number(day), hours, minutes, 0, 0);
}

module.exports = {
    buildShowDateTime
};
