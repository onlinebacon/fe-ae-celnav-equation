const img = document.querySelector('img');
const size = 600;

const SIDEREAL_DAY_MS = 86164090.53820801;
const NULL_ARIES_GHA_TIME = 1656652979900;
const MS_TO_DEGREES = 360 / SIDEREAL_DAY_MS;

const getAriesGHAAt = (date) => {
    const angle = (date - NULL_ARIES_GHA_TIME) * MS_TO_DEGREES;
    return (angle % 360 + 360) % 360;
};

const { PI, sqrt } = Math;

const toRad = (deg) => deg*(PI/180);
const toDeg = (rad) => rad*(180/PI);
const sin = (deg) => Math.sin(toRad(deg));
const cos = (deg) => Math.cos(toRad(deg));
const tan = (deg) => Math.tan(toRad(deg));
const asin = (sin) => toDeg(Math.asin(sin));
const acos = (cos) => toDeg(Math.acos(cos));
const atan = (tan) => toDeg(Math.atan(tan));
const miToDeg = (mi) => mi*(1609.34/(1852*60));
const pxToMiles = (px) => px/size*(360*60*1852/1609.34);

let HsToMiles = (hs) => {
    return (90 - hs)*69.05;
};

const parseAngle = (val) => {
    let [ a, b, c ] = val.split(' ').map(Number);
    return (Math.abs(a) + b/60 + c/3600)*(a < 0 ? -1 : 1);
}

const latLonToXY = (lat, lon) => {
    const dist = (90 - lat)/180*(size/2);
    const x = 0.5*size + dist*sin(lon);
    const y = 0.5*size + dist*cos(lon);
    return [ x, y ];
};

const xyToLatLon = ([ x, y ]) => {
    const dx = x - size/2;
    const dy = y - size/2;
    const len = sqrt(dx*dx + dy*dy);
    const lat = 90 - len/size*360;
    if (lat === 0) return [ 0, 0 ];
    const lon = acos(dy/len)*(x/Math.abs(x));
    return [ lat, lon ];
};

const compileSight = ({ ra, dec, alt, time }) => {
    const dt = new Date(time.replace(' ', 'T') + 'Z');
    const ariesGHA = getAriesGHAAt(dt);
    const lon = ((parseAngle(ra)*15 - ariesGHA)%360 + 180 + 360)%360 - 180;
    const lat = parseAngle(dec);
    const hs = parseAngle(alt);
    const gp = [ lat, lon ];
    const center = latLonToXY(lat, lon);
    const miRad = HsToMiles(hs); 
    const degRad = miToDeg(miRad);
    const radius = degRad/360*size;
    return { hs, gp, center, radius, miRad, degRad };
};

const calcDist = ([ ax, ay ], [ bx, by ]) => {
    const dx = bx - ax;
    const dy = by - ay;
    return sqrt(dx*dx + dy*dy);
};

const getIntersections = (c1, c2) => {
    const r1 = c1.radius;
    const r2 = c2.radius;
    const [ x1, y1 ] = c1.center;
    const [ x2, y2 ] = c2.center;
    const d = calcDist(c1.center, c2.center);
    const a = (r1*r1 - r2*r2 + d*d)/(2*d);
    const h = sqrt(r1*r1 - a*a);
    const nx = (x2 - x1)/d;
    const ny = (y2 - y1)/d;
    const mx = x1 + nx*a;
    const my = y1 + ny*a;
    const px = mx - ny*h;
    const py = my + nx*h;
    const qx = mx + ny*h;
    const qy = my - nx*h;
    return [[ px, py ], [ qx, qy ]];
};

const markErrorLine = (ctx, ax, ay, bx, by) => {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);

    ctx.strokeStyle = 'rgba(255, 128, 0, 0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
};

const plotAnswers = (ctx, results, [ lat, lon ]) => {
    const [ lx, ly ] = latLonToXY(lat, lon);
    results.forEach(([ x, y ]) => {
        markErrorLine(ctx, x, y, lx, ly);
    });
    results.forEach(([ x, y ]) => {
        markSpot(ctx, x, y, '#f00');
    });
    markSpot(ctx, lx, ly, '#07f');
};

const getResults = (c1, c2) => {
    const r1 = c1.radius;
    const r2 = c2.radius;
    const d = calcDist(c1.center, c2.center);
    const gap = d - r1 - r2;
    if (gap >= 0) {
        const dx = c2.center[0] - c1.center[0];
        const dy = c2.center[1] - c1.center[1];
        const f = (r1 + gap/2);
        const x = c1.center[0] + dx/d*f;
        const y = c1.center[1] + dy/d*f;
        return [[ x, y ]];
    }
    const min = Math.min(r1, r2);
    const max = Math.max(r1, r2);
    if (d + min < max) {
        if (r1 < r2) {
            const dx = c1.center[0] - c2.center[0];
            const dy = c1.center[1] - c2.center[1];
            const f = d + r1 + (r2 - (d + r1))/2;
            const x = c2.center[0] + dx/d*f;
            const y = c2.center[1] + dy/d*f;
            return [[ x, y ]];
        } else {
            const dx = c2.center[0] - c1.center[0];
            const dy = c2.center[1] - c1.center[1];
            const f = d + r2 + (r1 - (d + r2))/2;
            const x = c1.center[0] + dx/d*f;
            const y = c1.center[1] + dy/d*f;
            return [[ x, y ]];
        }
    }
    return getIntersections(c1, c2);
};

const drawCircle = (ctx, { center, radius }) => {
    ctx.lineWidth = 2;
    ctx.strokeStyle = ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(...center, radius, 0, PI*2);
    ctx.stroke();
    ctx.strokeStyle = ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(...center, 2, 0, PI*2);
    ctx.fill();
};

const markSpot = (ctx, x, y, color) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, PI*2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, PI*2);
    ctx.fill();
};

const formatDeg = (alt) => {
    return alt.toFixed(4);
    let t = (alt*60).toFixed(1)*1;
    let m = t % 60;
    let d = Math.round((t - m)/60);
    return `${d}° ${m.toFixed(1)}'`;
};

const formatGP = (lat, lon) => (
    formatDeg(Math.abs(lat)) + ' ' + (lat < 0 ? 'S' : 'N') + ', ' +
    formatDeg(Math.abs(lon)) + ' ' + (lon < 0 ? 'W' : 'E')
);

const sightToHTML = (sight) => `${
    sight.name
} - ${
    sight.time
} UTC - Hs: ${
    formatDeg(parseAngle(sight.alt))
}</br>GP: ${
    formatGP(...sight.gp)
} - Radius: ${
    sight.miRad.toFixed(2)*1
} mi / ${
    formatDeg(sight.degRad)
}°`;

const runFix = (ctx, info, fix) => {
    ctx.drawImage(img, 0, 0, size, size);
    ctx.fillStyle = 'rgba(40, 40, 40, 0.4)';
    ctx.fillRect(0, 0, size, size);
    const sight1 = { ...fix.sight1, ...compileSight(fix.sight1) };
    const sight2 = { ...fix.sight2, ...compileSight(fix.sight2) };
    drawCircle(ctx, sight1);
    drawCircle(ctx, sight2);
    const arr = getResults(sight1, sight2);
    const target = latLonToXY(...fix.loc);
    const found = arr.map(p => {
        return { loc: xyToLatLon(p), err: pxToMiles(calcDist(target, p)) };
    }).sort((a, b) => a.err - b.err).at(0);
    plotAnswers(ctx, arr, fix.loc);
    info.innerHTML += sightToHTML(sight1) + '</br>';
    info.innerHTML += sightToHTML(sight2) + '</br>';
    info.innerHTML += `Correct location: ${formatGP(...fix.loc)}</br>`;
    info.innerHTML += `Best fix: ${formatGP(...found.loc)} (${found.err.toPrecision(3)*1} mi off)`;
};

const fixHTML = `
    <div class="fix">
        <div class="info"></div>
        <canvas></canvas>
    </div>
`.trim().replace(/\s*\n\s*/g, '');

const htmlToDOM = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.children[0];
};

const fixContainer = document.querySelector('.fix-container');

const applyFix = (fix, fixDOM) => {
    const canvas = fixDOM.querySelector('canvas');
    const info = fixDOM.querySelector('.info');
    info.innerHTML = '';
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    runFix(ctx, info, fix, size);
};

fixArr.forEach(fix => {
    const fixDOM = htmlToDOM(fixHTML);
    applyFix(fix, fixDOM);
    fixContainer.append(fixDOM);
});

const updateFix = (index) => {
    const fix = fixArr[index];
    const fixDOM = document.querySelectorAll('.fix')[index];
    applyFix(fix, fixDOM);
};

const updateAll = () => {
    fixArr.forEach((_, index) => updateFix(index));
};

const textarea = document.querySelector('textarea');
textarea.value = HsToMiles.toString();
textarea.oninput = () => {
    try {
        eval(`HsToMiles = ${textarea.value};`);
        updateAll();
    } catch {}
};
