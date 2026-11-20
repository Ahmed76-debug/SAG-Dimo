path = r'src/pages/portfolio/PortfolioPage.tsx'
with open(path, encoding='utf-8', errors='ignore') as f:
    s = f.read()
old = '          </div>\n        </div>\n      </section>\n\n      <section className="grid gap-6 lg:grid-cols-3">'
new = '              </div>\n            </div>\n          </div>\n        </div>\n      </section>\n\n      <section className="grid gap-6 lg:grid-cols-3">'
if old in s:
    s = s.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    print('fixed')
else:
    print('no')
