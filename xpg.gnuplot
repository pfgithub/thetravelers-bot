set datafile separator ','
plot 'logs/xpg.csv' using 1:2 with lines, 'logs/xpg.csv' using 1:3 with lines, 'logs/xpg.csv' using 1:4 with lines
