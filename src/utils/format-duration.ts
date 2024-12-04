export const formatDuration = (duration: Date) => {
  const hours = Math.floor(duration.getTime() / 3600000);
  const minutes = Math.floor((duration.getTime() % 3600000) / 60000);
  const seconds = ((duration.getTime() % 60000) / 1000).toFixed(0);
  let formattedDuration = "";
  if (hours > 0) {
    formattedDuration += `${hours}h `;
  }
  if (minutes > 0 || hours > 0) {
    formattedDuration += `${minutes}m `;
  }
  if (parseInt(seconds) < 1) {
    formattedDuration += "<1s";
  } else {
    formattedDuration += `${seconds}s`;
  }
  return formattedDuration.trim();
};
