from urllib.request import urlopen
html = urlopen('https://raw.githubusercontent.com/tehnokv/picojs/master/cam.html').read().decode('utf-8')
print('\n'.join([line for line in html.split('\n') if 'pico' in line or 'facefinder' in line][:20]))
