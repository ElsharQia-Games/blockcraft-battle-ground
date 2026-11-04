/* CC0 1.0 firearm excerpts — Ben Jaszczak and the Firearm Sound Library team.
   Public mirror: https://github.com/buddingmonkey/FreeFirearmsSFXLibrary
   Provenance, original/embedded hashes and processing: assets/audio/LICENCES.md.
   Load this CLASSIC SCRIPT before src/94-audio.js. No fetch/XHR/imports.
   Mono 22.05 kHz, 64 kbit/s MP3 excerpts. LMG uses an adapted AK-47 recording.
   Reload/pump/bolt/cylinder and supporting shot layers are procedural. */
'use strict';
(function () {
  if (window.BCWeaponSamples && window.BCWeaponSamples.version === 1) return;
  var bank = {
    version: 1,
    title: 'Firearm Sound Library — near-distance single-shot excerpts',
    creator: 'Ben Jaszczak and the Firearm Sound Library team',
    sourceUrl: 'https://github.com/buddingmonkey/FreeFirearmsSFXLibrary/tree/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b',
    licence: 'CC0-1.0',
    licenceUrl: 'https://raw.githubusercontent.com/buddingmonkey/FreeFirearmsSFXLibrary/beb2f4041f3d6740fa0aeaf0e71159bd65a78c1b/LICENSE',
    downloadedAt: '2026-11-04',
    mime: 'audio/mpeg',
    entries: {
      revolver: {
        title: 'Smith & Wesson 642 — .38 Special revolver, near-distance gunshot',
        sourceFile: 'Prepared SFX/Smith & Wesson 642/V_27P.wav',
        seconds: 0.38,
        bytes: 3805,
        sha256: '2bc7d983d1d8f95b99b848780c4cd94f85b9b1642d73c4e9a165cfae1e812a40',
        base64:
          'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU1LjE0LjEwMQAAAAAAAAAAAAAA//OAwAAAAAAAAAAAAEluZm8AAAAHAAAAEQAADrAAHBwcHBwqKioqKio4ODg4' +
          'ODhHR0dHR0dVVVVVVVVjY2NjY2NxcXFxcXF/f39/f3+Ojo6OjpycnJycnKqqqqqqqri4uLi4uMfHx8fHx9XV1dXV1ePj4+Pj4/Hx8fHx8f//////TGF2ZjU1' +
          'LjE0LjEwMQAAAAAAAAAAJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/zgMQAIoDKOA1PeAERBxMs' +
          'avnUhoIQixNCWPUPcz8FsHA4lsLgqG85yDj1nGiA1Yua2pC2FwOiZjJwdDhDV6vZ9vFez7gPCI///4jvwMMjvEYGfwAP+OH5vgADgDoePzPwAHAHh4/M+T/j' +
          '/5mAB0PaDz4BmAjx/h78BEQR0P8PfAMwEeH+HvwdgZ/tB54AIiCOh/h5+AiXFwFIEuObauVua53O64+MBCv2NN1h9UgCY4jmppNcnE3y+MfZK8TiEKALIwFc' +
          'r0oXNRuY42AeB0n/84LEOTiDttJfmHgB0rguCGKhXnicRIzJeK5bWCFrb9Pqsbw7kcS06j9Sq8r0a8pq/7w/0y1ocpFOzqJtZKoSdrk8iXfx8U/lYX0BRNDK' +
          '9pJbVn1Z6fdMU1Nuke/j3MpSKltUul05MclH3vSiuhVmzlltW/xT3vulNXvuJTWJIeLxZ5ZX94lYMe7E+36+DZDp64q+3Pe+6U1e+6U1ffp//6YxDjV3m2b5' +
          '3T1vE6DXm6RxNiyx8Q3ra00NRplSpmvO9KbkokTXZUnMmEpkl6oKqf/zgsQbMAL2dAHYeABclTFMVrrDWUlyOpVq2Q/nx/DeMk5UNP14pi/GkdShVj5DkmoZ' +
          'WRXTMiucm1ifUesVmF7Iom5XJ7UsWj6zM2sr68W8BmzqErWWDrL17S2LWlesLLq3hPo1rbzSlrS1bXsF6ro3kZoTMxRq6zjOsxXsbFrVzF734vWsWDBi2jWt' +
          'a1rQq51Bi1r7e1rWtZ9CDURPMg6zKhIOgZ9rUV3ssYkRB15U7xTJyQSiEvx2Iy+7y14kyFkstiDLpXWlEvj8snpl9rtH//OCxB8vzBZEA1tYAAK2UOoNHkmj' +
          'tHckCMkNw6jcfTURgCgEjpBAPgTkhaGp0B0Qo3DqIY4LQ1aNyw3B6HUkVlpJOvNTVJIfipfRWceJpsa0lBtKTXelUWy73crPa2EnEpp1pNrdKiLa5NWtqD0t' +
          'ra10Eo8bJXFonjbdutspOt0/LXTX3SJqe//bUTTYc1p2HtbCR62//F//f9XxbvlZ01ffud1dItizbo9erWkqPGA9uADUKtQaGZpwpQvyGYzKnmh9xJA3W6wn' +
          'V+SQODFo5Rr/84LEIy+z0iQBnGAB/yoWRKEAHTGpIidJUIUmJJgEOTpYdzCZD+EqwdrG7bJw+7ZLHEpE8io3lAdlu2rVrTNXH0J3W3uugNNuunpOqhsP2tM5' +
          'fPlfeVeU6fpzFq5At1m9YfXc1nTuc5lrTS0/TvjnO3G9lStjpROsYVHiy9ruR/abZWZ3t7emts7v/6ZLk7Wk/XJmtlFIf93K7kz2MwW6cnHIbbqCpRNyAIyI' +
          'Aae2Q7xf8rUIGgXmOePKCtvVT30aM9ivXsZUWjZfRrMjG8xjWf/zgsQoNIwKLCubeAGWK40VxwD1mDHniTQ7aiW0fB8kJNJSvNQ04higQt4nkwyMTcrTdHsY' +
          'IhIfxNQ0bafs96328YUJfbi2fYwOodBWoM4Eqj1AsRNb/990pq+N2+s+1NV99GWhimYWdVvFekWJ6vtVL73d/HZKaxr4xqbVXv3rD7H/1rxWFigq1icUJaXC' +
          'K71Ftq+frfznf+/ncSmvimfS1N1+tXveSlPbOtVvTf3anxnPru1JS1UKu2MFzWmyapcqRFraPYcAZGsOpuzBZJiQ//OCxBku+wI9odqgAGYMePGzdxzdrzHl' +
          'joUh6RDZgTotDNRIAK/gaBcBJQMsMyHLgLBgGhBPl8gg5YoMn0jAgBIEUYihdJ84aKJgi6SFTJpMiX00icOn5uicNDNI1PuVjNSroppGBmX1Okgm6jNI0ZSb' +
          'ut0mRRpKWgp1rtU1JNNNTaDamM10UVurXWtt1Mhr1foIV01MpD0zBln0tDoXGCAyeEqm9ekeeGzaSLXPSxaRFgGnJJJJCJdNZzxhz6lfsMX1uMqAgYu+/cL2' +
          'EFmP3C//84LEITRT5oI+w9LfRC2JQRGSdZT7M4s7EpVWW9Rs2V/M6DOU9m2LPKh6rqpD/QyyvP9+oy+Cvk/LEaMJJxynP08kawKNDG5r6namp0zzMrO5UmtM' +
          '3RIwgtihJFGPipnRHJSCNfF1GVKc8jyOft9BWztucF8SWyNeMvB0oxaTUkrdrIZmoXSmYkjLk8DRrV6kSdVYsoy1EkfGVynFuD4GJGabq031s68FLycOvU28' +
          'tqUM68YeqrLb6tc5IGnq9QYCoU3HKUvy5qxM2JW8tSlf1f/zgsQTIaI+dh7DBrjkmC4lNYclDWqglFIMWG5ClkEURibJl1+pG/3XPopgcW0q5L2nq67LvGRa' +
          'WnsD653yhuFC2ejueDyLjO0tIr2Mal7TLlvT55X8zmfZ+ZAyawwFHhYBsaLrcWjXnnnRLHRZ4AH0NG66xnp0KC4RFC54ZRmJikAWKFf+sqGzE14sjYkxIusk' +
          'GXeFpCxCJ0VKhGQAkIEKLFIQq3J9qfXittKlRhW0GpqO6Gd2EV+0YmlgtIl5VNHDxG2VjpMzL/P8fusnLKJa//OCxFAmSU5MpMYYcbTF5cfKjI6XO61fjeV/' +
          'UuqbDNuyCmxc8rprnDePtMjiPrll5ScnoOxRPV/hKavm2Ih3Ow+quzdcb/H7O936u59WPRXv5i7/l4rVQAMrH/8/dSPxaBJx0o0iKu5xGRqaJaFCmajYQ50E' +
          'J4VzCB8GBtcgOHnhdllDfvO8Eoj+qj1TMzEn1r3qazM0cqzpMab72r+OP6s2tSuWy6WUFjCgrXq9e5MXOXqS/vPD+bzzt55WWrg3OmZ07Llz4d2JCrneoi5n' +
          'lSL/84LEeikbtkykxgbd36hVNzaFnO9Us5r7aul/Knl/Jn/edc89P/P8v98/XZWISPq6Znlm9H9hylQAACaTgWX+5Dqw9iL7gzrRyJNEpA3DAKVyRbI+juDN' +
          '8DRUdQldJOE4kHcCiOD7UzYzheu++PtUfgdO7OMN/k/auXmbfj2R1tn/bJzJzJyZ7F02mSXCZCaIPRBUayBqQIWcOIa9ILOfanqprVUzlU8zy2ithH3D12zc' +
          'x89b0fs+t3H0uM2O7thrMsuYrOlTz636+49N/vd/ev/zgsSZKMuqYfZ7DN2jrqyG1pG5p+r11WQBSB1f63uzxvZaGeK6cjmqznJAMAUonKFnMhpqjlHScLxS' +
          'NpsGmoIaQVCTQtQLiZ8qIjppu6fLKrUTRPFSyNOJgW1RK9ozvXzyCLmO5e35g5r2C0NyWSnvUfDWPbKzUyJVxuqJXzZ2MaX8xuMixnn7Dtv7Y/rtm/8vNzOz' +
          'xavR1zkrORvJaNWS/X9v/K7ve/L+Uue+p9Gls3Ssx9FIm0xBTUUzLjk5LjVVVVVVVVgA7c/50xNZ00op//OCxLknwrZRRHvMuVuOU7jB5UlAHHYBwNi1cvnr' +
          'CcwK5JJgfiLAfBSBZDdIbYMlaM5MSWfoZfAOBMpFgBgiCREIA4B4H9BLXPIZ/U+Wve5fI/Ybbte877Hx5Xf2l6XXbd34L3y8X1nabauZSChwC3gIXE9qAggb' +
          'UjGicTh94pUcttqYABhcHxeXOId/2FwfB8Hxcx9SQus/vWrkuh6maSsh4VVVLgqBQNkhkGx1JRBczFdN+IGjEPOzPKhbdukFaljs0rXWYtBfp/YbpL6eqnr/' +
          '84LEzyTp9lFAexiYRPrFWkslVWdhoUSd95WBILS+JMieGGYhBbewbCYB7apeSmzYf6/fjUaylUWmItcpaS+/v8wyh2GQqNBaIQZAiI4NRYFQLg+ASBcDYWBs' +
          'IIerB15Jtw+pJtCCccLHFB9tN9yqoeaSOGmlOpUKvyqrLMUUdE/2wszQUdDXUHFMUK1KrSqTcta1LXqv9wyqKmqqr/rVTKsLCxxxQsUEgoqL2tssKuISuYlE' +
          'ikKRItpijeFyCPCvmEix0wV2uSXtQpdJpZcJY//zgsT/NqPuPADGEN2XZUWY+sWk26U7i7UTijlRtnLRmmzVOyliLuv7RRq52VW7PYjDtnGGp6ljMka9PXKX' +
          'mWVWW00Rh2ZnYaTIlJOURagY8AhMAxHCSZFtIqNygVAKv4bjsS3zksSqnUcuknn+nmtfDktnzjfzLEsp8r+tp0WdtmafP+1b/VVX/752/pzq8osgNlsNVSp1' +
          'YaIiXaWPHgFK1RABZVIiepoy9xH7ikrjs1Sz0Va8pijcgyMBR0UDXoLywWxaDYOh7JhbQCcSTgjA//OCxOguC1YUAH4MvNglEwlmC9CKoqFQrEgtoBsTRyHk' +
          'glw7WXgSpi+ncj762ZTJk6xGpPjkrFNO5H31aZYp89arTKZCPKdnKLAii2ejTgMCEE1bndnfNypONFCj0LzZ9HFwtSRE4suLZ8/mWdnzf5Z/6k40SZcOxpwk' +
          'DMuHZziwMxNBaNGlRuf/Kd2vN+5VPGzU0aXFx/2d2vP+zu3+UacWTEFNRTMuOTkuNaqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr/84LE' +
          '8zD8FYwCwwzcqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq' +
          'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq' +
          'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqg=='
      },
      lmg: {
        title: 'AK-47 — 7.62x39 rifle, near-distance gunshot (adapted as LMG)',
        sourceFile: 'Prepared SFX/AK-47/C_28P.wav',
        seconds: 0.34,
        bytes: 3596,
        sha256: 'ab721c09da3337366467f5ddf5fe973c44889d834411886cc11855fae90cb359',
        base64:
          'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU1LjE0LjEwMQAAAAAAAAAAAAAA//OAwAAAAAAAAAAAAEluZm8AAAAHAAAAEAAADd8AHR0dHR0dLS0tLS0tPDw8' +
          'PDw8S0tLS0tLWlpaWlpaWmlpaWlpaXh4eHh4eIeHh4eHh5aWlpaWlpalpaWlpaW0tLS0tLTDw8PDw8PS0tLS0tLS4eHh4eHh8PDw8PDw////////TGF2ZjU1' +
          'LjE0LjEwMQAAAAAAAAAAJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/zgMQAH5O2cBdGQABoIpHG' +
          'e73tF3bGECCB4AACEGAgAGA4AAAIIhYNwbh+eQDcPz/cXcgG4f2gom9/oiV6V+iVIoKJ83/+7vcC73xX//CJUolb//u9wiSQlbu/y7u737v6IlSQif/pXu76' +
          'C578JX6JW7vDvf///CJUoibu97u9+lf/CJUihlFz/+UVIABhABBBWTkR8R7BIzKIvFRGABoAg60SH0uH/QHEEnQdZZEfCvHuFeN0gRLkKKUucII8ZAtzUdqG' +
          'oMlBJGYoWMxKF9L/84LERDwcDsDVmHgBctDwnCodqyJIQ8nx0IaXY/j+VyqhsbPl/tjZltCmtFnip4rYrpIydvGZHygiK9PqubDWoELU0CMzt6eixepm5zjs' +
          '0ferx4n+HkSlHbCrIqshxGWNTLivMzMxOa5fSxc1rC/iQ4+d/FPSmr/p/L1khw7XhWiatR1WDnVrNbLXWK5+9YiVvW/3/q8eJn+niZu8cPEgwdsunCF97vrV' +
          'cxNVhK6SFitH2fC/xF1CpWqBAa8GL4R/IVFgvozErmZiUTMbo3hxOf/zgsQXLEPapUHPSAEbompCXFmVpUAoAQMoVABBomiVAKBkysCQakVYRBZ8WYoQsauU' +
          'l2UhUQujbIWDSJFiyJMUsIrxDjSFJZMUwZlcUOLIrk1LVWU0KSHJNJoa/tWOVLff3q56laLYrbWpuVypeP9otyPlKV2zS08lFJ0ps//7UpXnlJNqWxz+peVx' +
          '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' +
          'BhFOcCGgXy9GW5mODhCsJGDYhjxVBLkmbYfrwbZAjGS5d15jJKgCfm4bpi1fLKZxK3LSSOkuZnohFuB+q5UuEzRpw3I1McJeZZ6voiubPBQPhPATDKlTUTki' +
          's7hKpax93bXHI/3rpuWjlezX6mI1ab/hqqGtf//95v/zgsSHKStGYKJ70L6nXjrX7tP4v/mOla562KwKWc0Yena7irrBLqKm31oG0B8y1e4XnJIOzmSCBNw/' +
          'WkYh3Avx7kICuJyhQ/1wcihJaZh1l8BsrzmSZkItAG+4Icqi0YjfORDEqSpWquOkGNOO2JDIKNaEbidXx61jtkWPBtDrGtCkc8gIgOUhHFmVSC4qcw4ymE0W' +
          'zzPZUfdGdXpKjzXP5n6JLW+V60up8t3K9aKglS6LSqWX2uWtzkGsLlawceM2n6R7Xvem1BdVyjwAGUO9//OCxKYoQ1ZkBHvKvDFGUUkfcaIN5HIpRmgBiFum' +
          'gIdSDxuyrmNYxuXKVNTbs+eoZdluDZn6d2ZvU8NM5prckj+TuzEZ9h1NhEnKo3ZnIJXbDbEZberU1qJP9Wz1lVoL9neW7gsERQWKcWcrFKQXBSiTgC0W0Fn/' +
          'UqOWHZaCxWlKzWcrG5brvqxpfobSxcy6o0rfsj9HqVt5ZlFREHZHVPHSVU7iowcDKlU1QFKSlsql3xKHqalsvrDjXlggcJW0QoUJhtWQSEoCns2dOZJVy03/' +
          '84LEySibTllEfgq85a7QGhK5XMsCn85EvRuV8yJMsHNROEQU71BFYwEFasHBUSJSAVMlVrXqsBONKnKutJhx+qaNO1IwREWGpJUpXDJ6dZiMn6wGRVfpeK56' +
          'dNsYVTgtcZPu6uhdnnmeyuX76tMwd7NFzzMS5r2n4vq0zel3eLAqVcWyM6WEUKgqQPZY6HXElCWRVDS5V2p2uEnz23lVTEFNRTMuOTkuNVVVVVVVVVVVVVVV' +
          'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zgsTqLiJWCADGGLhVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV' +
          'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxB' +
          'TUUzLjk5LjVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//OCxDsAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVV' +
          'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV' +
          'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU='
      },
      sniper: {
        title: 'Tikka T3 — .30-06 bolt-action rifle, near-distance gunshot',
        sourceFile: 'Prepared SFX/Tikka/W_29P.wav',
        seconds: 0.56,
        bytes: 5268,
        sha256: '0e6924ca44984d173cd4c6501e48f107fca41f0443708589ab2d52ff88ef981a',
        base64:
          'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU1LjE0LjEwMQAAAAAAAAAAAAAA//OAwAAAAAAAAAAAAEluZm8AAAAHAAAAGAAAFGcAFBQUFB4eHh4oKCgoMzMz' +
          'Mz09PT1HR0dHUVFRUVFcXFxcZmZmZnBwcHB6enp6hYWFhY+Pj4+PmZmZmaOjo6Ourq6uuLi4uMLCwsLMzMzMzNfX19fh4eHh6+vr6/X19fX/////TGF2ZjU1' +
          'LjE0LjEwMQAAAAAAAAAAJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/zgMQAJkJKRAFMYACZnV5m' +
          'JZnG2/9FhgYONmBMPKksEwJhWXAAwHozgSDzm15442vjYJB5CJBMqvX+ws1YeLObJYln7AhiW+wYGB442YONr32CQeQiATIm17/5S+MOadmZ+wIYlvwHBgeO' +
          'NmCzV7+LHNODxybr177BmvsxTV7+L17+MLFjlzBYAwffKOE4WB95zyjgQic/wQhj/D/4gcCEHz5d/B8mLrf++9st//+q4YSQsqVilDJ42X6hKIzlu/PpINzT' +
          '4d5lOuQkZbgugQr/84LEKjZzwtWVmHgBFCUwmZC0eDdH4SwjkKY0IrdUE9HiSFCFvZcc6urHkRSIxdvzmV5koSp2qP/EzdkVJ0mizp9tiPaphlmamymqPIj+' +
          '+/Oxw4T9/Eewm5dTK6IrasXvd48pfFH9767FGthziRmfuEHC9iHF7qDBw9zWz/dKav/7799/+FBix86zSaPq7NV7B08tX7pib5rXW7018U1e+/ndKa9NXvv6' +
          'vfN8fGZc/e6armexwL9WIplCCwkIDp3ATGLLF4kulBWirCz05Nxl3f/zgsQULiQClAPbQAGXva0pdywtE4LOWIuTOMqa8HoCQCwCwCwKTZuygVAAgAQCwCwd' +
          'AqCEYSSItCwAYWBqoqaKqCkAUAUPjg6D6Q5EUYeN5NJiGB42VQ4pg+j1JJNGB0H1McLD4arG0sSoqbLUqmrTNDQcMHxalMzWq18/VsUHRs0U3WuzNs1tUrUm' +
          'rU7L+zMTX8kmks237Mqqvyqtbf7MvzUmzX7MVDHdckqqqzMUFdU0YRQjAiAdMAMAAhALkJgCAApDPupi/U9L4cV0sC3r//OCxB8xU95YAPMQ3e0ZmItKq8BK' +
          'GkWpTl1gpnA5BUSiidrC8duxLzgKqjkTrioAYGRNTk66lMfMAlGVXl6xtcIIgk0JRKRqSTi21lq3XLzQ+3bJViroaWvEHyyockMHPYqSbbRMlSSaqrAqyOq0' +
          'DwfByOnKsORzvElCx0ipJx0yKitfTbTXfF/lCwsPur/mpaOoayTblahih9R3IqaqxyTyq6+181+smybV1SyOa2wqi0KVidQtYZ+ESYOhABg9FgWLqlx1AIai' +
          'cQjNDBMVqQz/84LEHS+ztjwg68zdzUVqWNRMMbQ5W1pPGCZhIy+NqldJ5jPxRupXkGI/w2vI8WF30VPJ1uY1hpj1aDyWVU42qnjlRSJRSRbHJ7mJPiXEurVn' +
          'cFU4q5lxO5I0WcaV/rWdLFsW7taC8f9qne7O8LRSkp8z47Sz9pOlni2rtZllFlFGkkdl8hC2syyizAIs42pSymevm927xZlmP68O1zXbftajuZqIxI9yotEo' +
          'c09tDwfEE4Y8BSYFgEDgxQORRkb2T0tpvvztjtrspqokZWSWT//zgsQiKHLOQMDqTLkWMEFM42pmNl3vYIG3wJCA9EnC4YElFxWTrwKGyOSiASKCywgExFMW' +
          'mnLMEGIEFm2AGRTv6z8YIGACEU0/ngtewZtYY0R3IId9jIbbZojbvKjO3MzYjy651DS005rMdoQjys9hlYhqx+4mYsy6Mw8ep3KamJSB6aSnIiU7vn3PBQAJ' +
          'eZdDM7VANaq0c3T7lDkRQwYJjEQUMMCQBBBW0wKETMQ0yBsOmmAzmMYAjHGY5BgAJ2ZyMsXYcYULGDg6QbOHjaI4//OCxEQrSa5nDObMlKzdrEYd9mDZkMy2' +
          '7TlBG0pbMboAgsmmkZRjplQ7u9+M+02tqa2MQJjDyd2UZB5BCCmv4lbTdcqDxFBkuNPhA9DBt7gxlwbA5otWfCBc615VR04bYBzxJKJxJ64Dvhhh/PjU30oy' +
          '65yji6oKb/aySRy22oq02OWNRqs0x0Ljx0ygEYhs7OZ46GGMoUpzyckxguJSY5IQFqw0lvFv4y6OHrAxkjMMNV8mIEhiAAIAUeOjBgVLNraeDWBkAL8GBCSZ' +
          's+m3Dqv/84LEWkJEBqJe3tLftprkw088CySIv+88HyF/ILZUtROhkdqpDC0G8nZFKJa/87DdPI5DE78MRWlqaqVft933WXML37wsPMWTiv4YYXUgjRwRwmqj' +
          'GvaZ5ogOtwXGDzZHFghJ8NkaixFCaxnV3oJPCikUaDDaNiDE0aUjCqJVtheoChZG86TlIKo0AYgLJBhF2IvjJdZgphZU0vBdSKC1WmF2sFZpqJPBhqru0ZPO' +
          '1/76Sso5OS8VIoKA8yibcbh/yK9pbTXqGWN1iEtT5aS7xf/zgsQVJyMqjLbTxr3RV1LbimJlqUcRUh0lhwu3zCwSJxqRjapW1vzJCsoo8O8CkeDqa8kWkKFi' +
          'DDcHtHJjs1M+dals7ruNJ703r0crIufLmpkdSLsVEyPFV7c6aGcIPDPUoZJNwikiA6JeIHsdnTZlMj125xj2IpkbJTMmv3rBjJxkjFjv8ceR//aSRJ6db9oq' +
          '55mqAttynVlMpjVLWmakfZS+MqcprT5v8SZQEmY6pw+y2zOL1nXSeYFUvvn2m5uw/xa7jJPSW5OIYjjCmg4Z//OCxDwfac6EFtPGlKqFUsszWZ8DMd8kOGCU' +
          'SUayeuv/ltwdqB0JINMYHTblVT1TjjwotEkMVdBdYCRNC7o1tvXcPlrFJWo9YRCeGyFcdQi2fgLhiQBobNdh6HX2gtqTiQzIJpAayhGmWykwARkeCpCTHMHC' +
          '9cGE7z9UbpTMRhqxZhxZbJtdvVhgtF66JgHZI4sDJMtGzzyqQIqJJ/HM8wQXa138yrJnp3f3993X35KwCCpa3KDy8AOA7QidA5YrA7z0EFSKELa+8eCRBCRR' +
          'zWD/84LEgiUJunAM48yUqhAv546CWevFnsyjgsUSk6UJKgCVs/ACUoZFZmqOmf2Qs/eCBGbuAytgDeVIVp8Owhg1QimYBoAReVFMJ2BNID9SRi5t8cGVg5xr' +
          'Md+Gq96CHb3mm36Fqr5SnnDy0UZn/WU5fyH1t8zbpEHB04VcMVBdxz+n+7Neptj3WPkT4aZQbP98v9b9szlKEST1/j3d1v/9lmBWQwzm3ECLuWDSyrhDvZ/n' +
          'VN0+ydNN7vEVIGtZ7AZphP7TYz8zZvupHYedWNuzDP/zgsSxJpqWeBTjDLnDzXGxyL7Kcy4WYa4XLDIbplDoH9AX3PM8605MjOW5geM6lgVvntUq6otMlKTY' +
          'zPV9F3qr19eNFvTcDdIKdQbSFK/bs2eTGseqmg2r+PWARFOm7XHI+++/7p0Utq18rP/87zDs7bG13pHcl/bb23/vLTPp2eoeKrvjR/rwv/+7krwffVG+tnk2' +
          '6UMPmvUjKkxBTUUzLjk5LjWqqggVaUUp8BaGAzXY1Syqu/shrXX8d5sUosR9/KsVhyStCU8QF1YEAWNi//OCxNopC050rOPMvRDRtWJOOCofVJo9cYBREqHz' +
          'QeURn2iowJEFNMN4YQcudOoBIzkYJ5s7ejFcz7VJSjBNtvPIDCQgrT/ktcVjPD1r+dx/TFIfs9O7JJTle8PPliCGredvNoyGq59uYZEf5n8REdt3O7///vHr' +
          'dZru7iCBhBPXfd8VlZjvru3fU5xrZq37V/MjFM11CIc5qxBfFg0JcqJQxJaRij+pYF3U65CqJ5iFEiJk3ngjxjHWPScxAU4JGkQHWCXQUpZQpHk5cXo9RCj/' +
          '84LE7SxcBnVW2kzd3RzD+dGCXl4fyOgKxmC+BvM0RhQ1SneoEc4EhGKISjWFOqk6XsQ31C+SUVQuCR8iFRw1AhXFKFiR9lQNPRilCrCTppLXfSvVbu18z9aW' +
          'kKsazPr71pEveXGiaSJmS0En9+43GKHLiqZY1D4rHyVCRNS1CyQximy6pSjUvnjUYbcv1kSKW9ZoKCn/2ZzQKbw5nF3TotYKKQnPoqmF4CF0VjPy5Ljs8Lww' +
          'CuVVRCACAugTDACTXS7ISKAsBdxdCcqmy15Uof/zgsT/NHNqWALT0r3sVLlKcLMgLNlbX3JeZnMYdZrLtuHHU13pWpfU1gjrsQdTP5Bjd4AkUphykjVJUjMs' +
          'ygkjPmCy7RtaURArKEGSRpkmkos8lgsuQn2aQot1ZG7ETKVxxJVqeXfXuT02lYRbjODWRh/8hkVl0vc6xLcXuV+t+5ccU2NRq/7v3TSdPWH8W0ntOLu199Bn' +
          '96pvsM0qJ9vztd/fVUxBTUUzLjk5LjUFjukCRIEmWw9xlbX3+XCXvTlYEAgGZ+mUlAjgXRAlR2EK//OCxPExEvJMAu4SuTyBYh+k/I5VhAGgXwdawThDkUdR' +
          'Dj5NNdnQYhGUipDnQZblNpva6NDG/U0dPqOHhUu198wPIT4LRhOeRSgxMgkTOh7opjCl+CnDT9SjJcCNhtns294lmxGX2tin2+2ZbVGHIz8d/tlf1z61hiLi' +
          '38s53j5PIsezRj/9/t9f7+WSThO3ifPssxWlTEFNRTMuOTkuNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/84LE' +
          '5irCRlAE68y5VVVVVVVVVTAbrW25CNK7ytbx5M1K1FMVpbUBFfe6Gdx1Yiau5XltXXlMNKsL6a9HVuF2vU3YNtSgY4RaqSlko5ORPSYOb70YizYzUZp1CFP1' +
          '4fO5L9M6JqdINWk3RNzTkxzoOEMV6MXlNzULK/9cY6h/99mf0P5RAZq3w/RTOy5znxPfvbmd/xVMQU1FMy45OS41VVVVVVVVVQGaUp2uCzLaaU6f21GoagRu' +
          'q2MHicu/GnsQBNeXu74QoiyE54HY7lERjv/zgsS9IFIOfXbbBpsEJORQYr/LrIe8ndPmkwUC7EOXIIGENlp5YmO22F+2XNWf+n+qdadtjkNqtVemsvew8oau' +
          '+xepF5LynDoM7sha9qoOc5CrtMtSY6kLzK9ZjqTysird9xiqLltqu+zTvOPKL5MV+8v23vPlIvT1P9qX1kn/qoe9/+7nxtwqfbp5huO6sJ5D8IcNMkxBTUUz' +
          'Ljk5LjWqqqqqqqqqqqqqqqqqqqqqqqqqAJtunN4OI4xqdpq8YpXemV4uI0hYVp6ooeZuwG+8//OCxO4sq9pQFusM3U/QM0yQwH8zB0FisLh7LRIMD9CVIReR' +
          '2O3CCVy2WrNQRO0qeNLVfMsrLUlprXOg6u6v9ym72PYxLV/veu593HdxhECIKwr3sZCEBIDMxaATiWQLCZysBIgNIuLbL8vzadqZEcuB7q8eYNIiJlsJOS6F' +
          'V+kRaqVh/2VTP94RYhFkeTgoHgt8Y36qTEFNRTMuOTkuNaqqCC5++IgGCFdzXXKf2DHla0swKgJMULKm3bVGQuUHJdRBlClQYtEisoE67iNgehn/84LE4imT' +
          'plAW6wbdk23H3YpDrtPM2OC3+cd4YysC7VqHIpJpiWRKFyyhlMLg/sCU8ZwvYv1TT1ggWMHKNH2bhCcDJBQ8dAqOsOjSYWjqU5xfDswYekSxQdCdUH3dtERL' +
          'bWwz/5Web8ZkXW3NTT6/8tXB0hMUUkT4uGp2EpaLi817PLb9JatxnFusNh2bBLqXSwdp70UZ8GrBjwGpg6BAQApeqKF1kHkok0zAgFVFFRjwJq8AABoWhYBS' +
          'WgFpfg2BTUWKSCHBMKwA7OMPISUsxf/zgsTzLfquPAzuELnpc0WrDcL+hJNR5F4FjGISohZlKoMg60C1IaZJ3NJ1x3qujJtqUS+oV1rJ6exTF5XGK90lkc8P' +
          '3cqsbSr7vqNU8vgcP3X6rXarV2RXdjg/rfar0V7bNX6u/Tcmv9reU+39OZSGevms2RMayNLgSab+PqC7R2LEus006ZByqulsjWBN3H9+9jpsNLPmxUxBEIJK' +
          'GkSoC3Q4uHgFVyzWnSFoqg0jehCU37OY4sM5wZwRpToSpTJTx8gmQDYWpWyGCDlLy+s9//OCxP8xsn4wAuvYuaTwEOfK5tccNpymSvIVfEZiQ5mbTpm9t/43' +
          '/B0xK1Wq1WobNCfQZYtRUk2pFW8oWFjpUpxUOQFRFKHqNNKOkOQaior/rkiqlC11rTFLyK1KiEDYVN9ablrVRUVVaWim/9myTa2Fq+9jpFWev/JFmb/WNmv/' +
          'aJWCjpxCksJMUelhDTsvBQbHIbUqEd0/plvuGr6qbwZBtM3mnCUZnKJj40GJT6ATqYaKhicTgIkEQvKAii0marpuTJ1Ip1CahxAzQNwD+Dv/84LE+i+LfiAW' +
          '29C9wzBxl4S7QtMr6SHEncVcwrpfX3k9aRnqmUqRXCvcI80Z7CxnGcZklgYzi+t/4x/qz182tzc3wL6zaDJIWj1atL0yspRIwYWYPNKJGDRpB9NNMSSMdHif' +
          'mJ9lKGjUumVpiJS6///+f/+1aJR6tSiRKQWj1atD1ZpwqHQSiUQBcddS0qMGxMTH/0ylDRpAeNPVlhZMQU1FMy45OS41qqqqqqqqqqqqqqqqqqqqqqqqqqqq' +
          'qqqqqqqqqqqqqqqqqqqqqqqqqv/zgsT/M0PVbALj0Nyqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq' +
          'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq' +
          'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'
      },
      shotgun: {
        title: 'Benelli Nova — 12 gauge pump-action shotgun, near-distance gunshot',
        sourceFile: 'Prepared SFX/Nova/O_21P.wav',
        seconds: 0.46,
        bytes: 4432,
        sha256: 'b51f77a0682dc98e8380d3a27fb7a15709a7f675534bb809b7a4192e53b97bc2',
        base64:
          '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' +
          'AEGjKkamZMNUbFOs3jhEIsmFJJTcmDqBPFck9hOEWOqqkden2lvrMampuNN/FJ3Fdmm1HIlQ9OuaZuHWklW5OvJKcIT1a7zx8Nq8zVZhdcE2xsxJJ51rw6nr' +
          '4ku6BhUXcVWAIvKmludWAms17TxsZDDQc5w9VdiqqmgUiI2GPIEUbzNdDmAoQIKk+kQ6SJrdE670//OCxP8zUzpEAMYSvTE640TjrcVsv3FGZs6bVlCWrOX1' +
          'fq5Q0FBAbfz1DuAmyQqOR2WsRhqep9RCEykjQqvYLGx+25AUSYccooYgnKGxhl3KqegUShGcdNIcWNSivBlJ1bXv74xzaiveZU55kJSxWPkxCHhuZkqjsp3W' +
          'QhCvTpbdbOdJd7jB5k2s2qbxxFegk/vivn8EvbB+4pB5VYIhEmq1r8pqshmkxkEEbLio3D0UzkORa8FAbIpcffF5xmANRlBUlsFyQTlcOYTgdRfApxH/84LE' +
          '9TAjBkSixhK5ZOl2GK5JdnNBbCqXaHPzmWozcYKbTrUc1ls7idKdxTrO1RHKJERarUPhRHzK1QqTKpcLpVa0xYiX3h9Z3aUJZeV8yzXKWi2hQnDTmQ8sSRB2' +
          'XBpwHuoHEiVNm58LasaeXG7KLInqzdwvkmuajX5V3JGWlvjfp5rt5m9mXbz631Xen2s89485+2NVP2a8187N/lev86l2oev3JdKoemVVS5SJyfTis9LMvYzF' +
          'NA0TNwWQMXAhQgKpUTQAdDZylMk6oi3J3//zgsT4MjQWPKLDzNxFVfCudVu00dfn8d6rRqXVptnLWWHNOgGQP9utlDVSncmkp3JjDOp+1GpK4t6m3vl6XPC6' +
          'uNnUNOVLYlD2cph3kps+wMSrXIomkZn8UArsizzBIkvnLim2eck5FE1HnRra2y3/n+jc/EgGNltmc7kZI5WbOaaRROlt9bLEkZw7e8tOdqrfNVRy57vWtVUd' +
          'stnp0qdDhXLKQYaRunYj1SxM5kiTB+iKjQHeSAnZNB5C4kiPhD1YzqFTrzMJ4bGJkcl4eRUK//OCxPMxW6YcAMYM3IezAtolTtr2rSN15amQ4afattghhp9b' +
          'bn1Zgu48enRVKSQ/iern1tl6XieWtQtob+zs+5TxqJISWY/7ScaJMuLze7xs1NGihR6C839v3bcqSm3/+jTjiziyiyiyirVU07O+U7XlS8LRJGlFmQuSrQSI' +
          'nFWgtGna9mi4tGjXi41EkCigI8DVRX/1gmpMQU1FMy45OS41qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr/84LE8S3T' +
          '1bwUewzdqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq' +
          'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq' +
          'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqg=='
      },
      rifle: {
        title: 'AR-15 / M4 — .223 / 5.56x45 rifle, near-distance gunshot',
        sourceFile: 'Prepared SFX/AR-15/D_32P.wav',
        seconds: 0.26,
        bytes: 2760,
        sha256: '1d4caa6269bf3acb12928ab8e3543a24510143c41f6a7b5d4322a838229b7e63',
        base64:
          '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'
      },
      smg: {
        title: 'Carl Gustav M45 / Swedish K — 9 mm SMG, near-distance gunshot',
        sourceFile: 'Prepared SFX/Carl Gustav M45/G_31P.wav',
        seconds: 0.18,
        bytes: 2133,
        sha256: 'c450151d6c70e33509f8afb4e222e39fcb349c688b1bf0521873ac081fba1481',
        base64:
          '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'
      },
      pistol: {
        title: '1911 — .45 pistol, near-distance gunshot',
        sourceFile: 'Prepared SFX/1911/A_42P.wav',
        seconds: 0.32,
        bytes: 3387,
        sha256: 'fb52b1a4a6e480138db0a0a5b2c7048beeb6e93279a0734fd85beec17e9a5120',
        base64:
          'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU1LjE0LjEwMQAAAAAAAAAAAAAA//OAwAAAAAAAAAAAAEluZm8AAAAHAAAADwAADQ4AHx8fHx8fLy8vLy8vLz8/' +
          'Pz8/P09PT09PT09fX19fX19fb29vb29vf39/f39/f4+Pj4+Pj4+fn5+fn5+vr6+vr6+vv7+/v7+/v8/Pz8/Pz9/f39/f39/v7+/v7+/v////////TGF2ZjU1' +
          'LjE0LjEwMQAAAAAAAAAAJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/zgMQAJCICIAFPYAB/Z48q' +
          'nzTQtECbkLcjkJwaCoiUf3v6PHkTWdMzMzPbe+HAkHkIkKE5nGOAAgUJQAAoQxDLZcBADiUAQKGRLJ9iQTHSQec2vv+Uf+lObO18BmfwLHGyWT4BLLcBg4nE' +
          'sntCWW4DBZCZmdjM/ssWc2/i98CAh//B8+H5cHwO+Jw/w////8MF4ICQaHxAEQQE44EF/LVd4uOIKu+/mXfaGTAQlKBdccNePCXcySAHUBQkDZczF4yaOgG+' +
          'DEYhAkXr8tT6H+P/84LEMjiT2s2VmHgB+K469wIjAXcCXPcKZCkUf5eHkRWMmhMAcpKhaQ5RJ1Mu1GrGSJ6a90yeqnOBxbFIxMcVugq93/e/vH2/bpFZAUTb' +
          'COpPrpmX25qnoro7/bPf3+vT/nUh2Fc7YLK+Ix51h1BetUakJyZpPGm/vvMO+b797/O4kzg1SvGqVrclmLCrnET5+NP9UxEgtv1H/+8a+v/6f0p6U1nHtPWf' +
          'OsVzSabFZYEODHgZvAa6KSIVeYOVwAGN4tx1R3p+k5QluevkOZkdt//zgsQTLVsenUPPeAEFpSoczQUNRI3QMoSEhJcnJuJ6DlJKX0L0Q00nJyngtRKidGk4' +
          'n8XJypGbU6hsa0ararWFhTqiZp97tJI+pr43qCyvbX9YMXLCwvpavYL3WIVa1m/gvXtt79aWxb/1t7fD17XOq11nfr9Z+vmC9ixfq1nta/fg1ra1rWtutce2' +
          '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' +
          '7EUct/5fLKStT5XJXyfoZXUysYYV89Y1btaz2U0k5h2zYtallr+50+qSWcp79fDlSdnqWI0Nabry+7njhzvLuW+VL93GfoKazdmPs/P2vqY3LvMK2V+U8qU1' +
          'L9XWdokA+or8/3+rsHymP4Q430Qgt/34GiIWSgvINv/zgsQXMGtCgAGYeAEFpHAD9IKGIqmJjKOGxg/T1JQhNXFzJWaeU+egmyjTzvUW1lfCV6jydRvOnzdl' +
          '6hq8dRzNsOHSekSloEaVxYaqE/YTMpoM02Mbxn+kRziyea1X06mrLv2pmWPCeY1AiTwNR75iV3Tq5nbo3w+pmDiuY9Y9Izzc0O8fEC2r5pn6zZ5qsSJSkD1p' +
          'WSDqTNZK4zv+LfE8DTzMfKRYceWcpcpT3p7f/9rzdyiwTdWVkAW91+O+kjzZyuLMTuGumAvItyHObhH0//OCxBkjcfp55c9IAaYuJwEkATBYVqhladCADYYE' +
          'aRkuTKlThCTIBdglagqcIWmG5sI3I0Cak7ky+E62W5v///+f19hXr1aKMtj4zdOGRl98orWJpFTf+BYbFQ6WH6mub7vOhVHBNJ0Qd4h6vvNcah8Y1//b9X//' +
          'b+v5PIq+4LRVcdQPV/aRJs2FUAJBpo/ThEeRpPS8qVDS+iamqFUgWISY1mRVJ16W1jRpKlWyLZcS7NLa2LtYUTCpnPDcuXGUTgHJS8r0ci1ZKpOj5ctdOn7/' +
          '84LETyfqOkFAS9iYj1dWwuPMu9M5Wi6zLsrYKrXawH1bMwxNPM0u611ettaunUEdHma1ma5aWnqkRK4tbLGmEp4q6RETyJ1CAoBWHcRCVMtDv+oGqwVGAUBT' +
          'uIh6CeVbbm5/PHxiZEkchSZxmlEOYXUZRGyQFvLghaMWVcnVMuVwp1YzuTKrk6bx6nod52JBdrh/EnmjRXrEwtxU4XICNeFyisqWGRCIhkYEYoJzD2lUl2Hs' +
          'yVQolSxU4XKFzpRGYNEpEVLFjpRGgbdv918lFf/zgsRzKHo5MCpj0piVVSXYeyiVSWTUbc1EKiweAoqKeLINCrEAUKiosLC3+KiooLIf1CwukBBIWFWeLUxB' +
          'TUUzLjk5LjVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV' +
          'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV'
      }
    }
  };
  Object.keys(bank.entries).forEach(function (id) { Object.freeze(bank.entries[id]); });
  Object.freeze(bank.entries);
  window.BCWeaponSamples = Object.freeze(bank);
})();
