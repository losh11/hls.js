/*
 * Stats Handler
 *
 */

import Event from './events';
import observer from './observer';

class StatsHandler {
    constructor(hls) {
        this.hls = hls;
        this.onmp = this.onManifestParsed.bind(this);
        this.onfc = this.onFragmentChanged.bind(this);
        this.onfb = this.onFragmentBuffered.bind(this);
        this.onflt = this.onFragmentLoadTimeout.bind(this);
        this.onfle = this.onFragmentLoadError.bind(this);
        this.onfpsd = this.onFPSDrop.bind(this);
        observer.on(Event.MANIFEST_PARSED, this.onmp);
        observer.on(Event.FRAG_BUFFERED, this.onfb);
        observer.on(Event.FRAG_CHANGED, this.onfc);
        observer.on(Event.FRAG_LOAD_ERROR, this.onfle);
        observer.on(Event.FRAG_LOAD_TIMEOUT, this.onflt);
        observer.on(Event.FPS_DROP, this.onfpsd);
    }

    destroy() {}

    attachVideo(video) {
        this.video = video;
    }

    detachVideo() {
        this.video = null;
    }

    // reset stats on manifest parsed
    onManifestParsed(event, data) {
        this._stats = { tech: 'hls.js', levelNb: data.levels.length };
    }

    // on fragment changed is triggered whenever playback of a new fragment is starting ...
    onFragmentChanged(event, data) {
        var stats = this._stats,
            level = data.frag.level,
            autoLevel = data.frag.autoLevel;
        if (stats) {
            if (stats.levelStart === undefined) {
                stats.levelStart = level;
            }
            if (autoLevel) {
                if (stats.fragChangedAuto) {
                    stats.autoLevelMin = Math.min(stats.autoLevelMin, level);
                    stats.autoLevelMax = Math.max(stats.autoLevelMax, level);
                    stats.fragChangedAuto++;
                    if (this.levelLastAuto && level !== stats.autoLevelLast) {
                        stats.autoLevelSwitch++;
                    }
                } else {
                    stats.autoLevelMin = stats.autoLevelMax = level;
                    stats.autoLevelSwitch = 0;
                    stats.fragChangedAuto = 1;
                    this.sumAutoLevel = 0;
                }
                this.sumAutoLevel += level;
                stats.autoLevelAvg =
                    Math.round(
                        1000 * this.sumAutoLevel / stats.fragChangedAuto
                    ) / 1000;
                stats.autoLevelLast = level;
            } else {
                if (stats.fragChangedManual) {
                    stats.manualLevelMin = Math.min(
                        stats.manualLevelMin,
                        level
                    );
                    stats.manualLevelMax = Math.max(
                        stats.manualLevelMax,
                        level
                    );
                    stats.fragChangedManual++;
                    if (
                        !this.levelLastAuto &&
                        level !== stats.manualLevelLast
                    ) {
                        stats.manualLevelSwitch++;
                    }
                } else {
                    stats.manualLevelMin = stats.manualLevelMax = level;
                    stats.manualLevelSwitch = 0;
                    stats.fragChangedManual = 1;
                }
                stats.manualLevelLast = level;
            }
            this.levelLastAuto = autoLevel;
        }
    }

    // triggered each time a new fragment is buffered
    onFragmentBuffered(event, data) {
        var stats = this._stats,
            latency = data.stats.tfirst - data.stats.trequest,
            bitrate = Math.round(
                8 *
                    data.stats.length /
                    (data.stats.tbuffered - data.stats.tfirst)
            );
        if (stats.fragBuffered) {
            stats.fragMinLatency = Math.min(stats.fragMinLatency, latency);
            stats.fragMaxLatency = Math.max(stats.fragMaxLatency, latency);
            stats.fragMinKbps = Math.min(stats.fragMinKbps, bitrate);
            stats.fragMaxKbps = Math.max(stats.fragMaxKbps, bitrate);
            stats.autoLevelCappingMin = Math.min(
                stats.autoLevelCappingMin,
                this.hls.autoLevelCapping
            );
            stats.autoLevelCappingMax = Math.max(
                stats.autoLevelCappingMax,
                this.hls.autoLevelCapping
            );
            stats.fragBuffered++;
        } else {
            stats.fragMinLatency = stats.fragMaxLatency = latency;
            stats.fragMinKbps = stats.fragMaxKbps = bitrate;
            stats.fragBuffered = 1;
            stats.fragBufferedBytes = 0;
            stats.autoLevelCappingMin = stats.autoLevelCappingMax = this.hls.autoLevelCapping;
            this.sumLatency = 0;
            this.sumKbps = 0;
        }
        this.sumLatency += latency;
        this.sumKbps += bitrate;
        stats.fragBufferedBytes += data.stats.length;
        stats.fragAvgLatency = Math.round(this.sumLatency / stats.fragBuffered);
        stats.fragAvgKbps = Math.round(this.sumKbps / stats.fragBuffered);
        stats.autoLevelCappingLast = this.hls.autoLevelCapping;
    }

    onFragmentLoadTimeout() {
        var stats = this._stats;
        if (stats) {
            if (stats.fragLoadTimeout === undefined) {
                stats.fragLoadTimeout = 1;
            } else {
                stats.fragLoadTimeout++;
            }
        }
    }

    onFragmentLoadError() {
        var stats = this._stats;
        if (stats) {
            if (stats.fragLoadError === undefined) {
                stats.fragLoadError = 1;
            } else {
                stats.fragLoadError++;
            }
        }
    }

    onFPSDrop(event, data) {
        var stats = this._stats;
        if (stats) {
            if (stats.fpsDropEvent === undefined) {
                stats.fpsDropEvent = 1;
            } else {
                stats.fpsDropEvent++;
            }
            stats.fpsTotalDroppedFrames = data.totalDroppedFrames;
        }
    }

    get stats() {
        if (this.video) {
            this._stats.lastPos = this.video.currentTime.toFixed(3);
        }
        return this._stats;
    }
}

export default StatsHandler;
