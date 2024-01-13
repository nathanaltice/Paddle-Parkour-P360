class Play extends Phaser.Scene {
    constructor() {
        super('playScene')
    }

    init() {
        // reset parameters
        this.barrierSpawnDelay = 2500
        this.barrierSpeed = -450
        this.barrierSpeedMax = -1000

        this.paddleWidth = 16
        this.paddleHeight = 128
        this.paddleVelocity = 150
        this.paddleX = 32
        this.paddleMaxVelocity = 600
        this.paddleBounce = 0.5
        this.paddleDragY = 200

        this.level = 0
        this.hardMODElevel = 10
        this.extremeMODElevel = 15
        this.extremeMODE = false
        this.shadowLock = false
    }

    create() {
        // set up audio, play bgm
        this.bgm = this.sound.add('beats', { 
            mute: false,
            volume: 1,
            rate: 1,
            loop: true 
        })
        this.bgm.play()

        // add snapshot image from prior Scene
        if (this.textures.exists('titlesnapshot')) {
            let titleSnap = this.add.image(centerX, centerY, 'titlesnapshot').setOrigin(0.5)
            this.tweens.add({
                targets: titleSnap,
                duration: 4500,
                alpha: { from: 1, to: 0 },
                scale: { from: 1, to: 0 },
                repeat: 0
            })
        } else {
            console.log('texture error')
        }

        // 🎉 let's get the PARTYcles started 🎉
        // create line on right side of screen for particles source
        let line = new Phaser.Geom.Line(w, 0, w, h)  
        // set up particle emitter  
        this.lineEmitter = this.add.particles(0, 0, 'cross', {
            gravityX: -200,
            lifespan: 5000,
            alpha: {
                start: 0.5,
                end: 0.1
            },
            tint: [ 0xffff00, 0xff0000, 0x00ff00, 0x00ffff, 0x0000ff ],
            emitZone: { 
                type: 'random', 
                source: line, 
                quantity: 150 
            },
            blendMode: 'ADD'
        })

        // set up player paddle (physics sprite) and set properties
        this.paddle = this.physics.add.sprite(this.paddleX, centerY, 'paddle').setOrigin(0.5)
        this.paddle.setCollideWorldBounds(true)
        this.paddle.setBounce(this.paddleBounce)
        this.paddle.setImmovable()
        this.paddle.setMaxVelocity(0, this.paddleMaxVelocity)
        this.paddle.setDragY(this.paddleDragY)
        this.paddle.setDepth(1)        // ensures that paddle z-depth remains above shadow paddles
        this.paddle.destroyed = false       // custom property to track paddle life
        this.paddle.setBlendMode('SCREEN')  // set a WebGL blend mode

        // set up barrier group
        this.barrierGroup = this.add.group({
            runChildUpdate: true    // make sure update runs on group children
        })
        // wait a few seconds before spawning barriers
        this.time.delayedCall(this.barrierSpawnDelay, () => { 
            this.addBarrier() 
        })

        // set up difficulty timer (triggers callback every second)
        this.difficultyTimer = this.time.addEvent({
            delay: 1000,
            callback: this.levelBump,
            callbackScope: this,
            loop: true
        })

        // set up cursor keys
        cursors = this.input.keyboard.createCursorKeys()
    }

    // create new barriers and add them to existing barrier group
    addBarrier() {
        let speedVariance =  Phaser.Math.Between(0, 50)
        let barrier = new Barrier(this, this.barrierSpeed - speedVariance, this.paddleWidth, this.paddleHeight)
        this.barrierGroup.add(barrier)
    }

    update() {
        // make sure paddle is still alive
        if(!this.paddle.destroyed) {
            // check for player input
            if(cursors.up.isDown) {
                this.paddle.body.velocity.y -= this.paddleVelocity
            } else if(cursors.down.isDown) {
                this.paddle.body.velocity.y += this.paddleVelocity
            }
            // check for collisions
            this.physics.world.collide(this.paddle, this.barrierGroup, this.paddleCollision, null, this)
        }

        // spawn rainbow trail if in EXTREME mode
        if(this.extremeMODE && !this.shadowLock && !this.paddle.destroyed) {
            this.spawnShadowPaddles()
            this.shadowLock = true
            // lock shadow paddle spawning to a given time interval
            this.time.delayedCall(15, () => { this.shadowLock = false })
        }
    }

    levelBump() {
        // increment level (ie, score)
        this.level++

        // bump speed every 5 levels (until max is hit)
        if(this.level % 5 == 0) {
            //console.log(`level: ${this.level}, speed: ${this.barrierSpeed}`)
            this.sound.play('clang', { volume: 0.5 })         // play clang to signal speed up
            if(this.barrierSpeed >= this.barrierSpeedMax) {     // increase barrier speed
                this.barrierSpeed -= 25
                this.bgm.rate += 0.01                          // increase bgm playback rate (ドキドキ)
            }
            
            // make flying score text (using three stacked)
            let lvltxt01 = this.add.bitmapText(w, centerY, 'gem', `<${this.level}>`, 96).setOrigin(0, 0.5)
            let lvltxt02 = this.add.bitmapText(w, centerY, 'gem', `<${this.level}>`, 96).setOrigin(0, 0.5)
            let lvltxt03 = this.add.bitmapText(w, centerY, 'gem', `<${this.level}>`, 96).setOrigin(0, 0.5)
            lvltxt01.setBlendMode('ADD').setTint(0xff00ff)
            lvltxt02.setBlendMode('SCREEN').setTint(0x0000ff)
            lvltxt03.setBlendMode('ADD').setTint(0xffff00)
            this.tweens.add({
                targets: [lvltxt01, lvltxt02, lvltxt03],
                duration: 2500,
                x: { from: w, to: 0 },
                alpha: { from: 0.9, to: 0 },
                onComplete: function() {
                    lvltxt01.destroy()
                    lvltxt02.destroy()
                    lvltxt03.destroy()
                }
            })
            this.tweens.add({
                targets: lvltxt02,
                duration: 2500,
                y: '-=20'       // slowly nudge y-coordinate up
            })
            this.tweens.add({
                targets: lvltxt03,
                duration: 2500,
                y: '+=20'       // slowly nudge y-coordinate down
            })
 
            // change game border color
            let rndColor = this.getRandomColor()
            document.getElementsByTagName('canvas')[0].style.borderColor = rndColor

            // cam shake: .shake( [duration] [, intensity] )
            this.cameras.main.shake(100, 0.01)
        }

        // set HARD mode
        if(this.level == this.hardMODElevel) {
            this.paddle.scaleY = 0.75       // 3/4 paddle size
        }
        // set EXTREME mode
        if(this.level == this.extremeMODElevel) {
            this.paddle.scaleY = 0.5        // 1/2 paddle size
            this.extremeMODE = true         // 🌈
        }
    }

    // random HTML hex color generator from:
    // https://stackoverflow.com/questions/1484506/random-color-generator
    getRandomColor() {
        let letters = '0123456789ABCDEF'
        let color = '#'
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)]
        }
        return color
    }

    spawnShadowPaddles() {
        // add a "shadow paddle" at main paddle position
        let shadowPaddle = this.add.image(this.paddle.x, this.paddle.y, 'paddle').setOrigin(0.5)
        shadowPaddle.scaleY = this.paddle.scaleY            // scale to parent paddle
        shadowPaddle.tint = Math.random() * 0xFFFFFF   // tint w/ rainbow colors
        shadowPaddle.alpha = 0.5                       // make semi-transparent
        // tween shadow paddle alpha to 0
        this.tweens.add({ 
            targets: shadowPaddle, 
            alpha: { from: 0.5, to: 0 }, 
            duration: 750,
            ease: 'Linear',
            repeat: 0 
        })
        // set a kill timer for trail effect
        this.time.delayedCall(750, () => { shadowPaddle.destroy() } )
    }

    paddleCollision() {
        this.paddle.destroyed = true               // turn off collision checking
        this.difficultyTimer.destroy()             // shut down timer
        this.sound.play('death', { volume: 0.25 }) // play death sound
        this.cameras.main.shake(2500, 0.0075)      // camera death shake
        
        // add tween to fade out audio
        this.tweens.add({
            targets: this.bgm,
            volume: 0,
            ease: 'Linear',
            duration: 2000,
        })

        // store current paddle bounds so we can create a paddle-shaped death emitter
        let pBounds = this.paddle.getBounds()
        // set up particle emitter
        let deathEmitter = this.add.particles(0, 0, 'cross', {
            alpha: { start: 1, end: 0 },
            scale: { start: 0.75, end: 0 },
            speed: { min: -150, max: 150 },
            lifespan: 4000,
            blendMode: 'ADD',
            emitZone: {
                source: new Phaser.Geom.Rectangle(pBounds.x, pBounds.y, pBounds.width, pBounds.height),
                type: 'edge',
                quantity: 1000
            }          
        })
        // make it boom 💥
        deathEmitter.explode(1000)
        // create two gravity wells: one offset from paddle x-position and one at center screen
        deathEmitter.createGravityWell({
            x: pBounds.centerX + w / 4,
            y: pBounds.centerY,
            power: 0.5,
            epsilon: 100,
            gravity: 100
        })
        deathEmitter.createGravityWell({
            x: centerX,
            y: centerY,
            power: 2,
            epsilon: 100,
            gravity: 150
        })
       
        // kill paddle
        this.paddle.destroy()   

        // switch scenes after timer expires, passing current level to next scene
        this.time.delayedCall(4000, () => { this.scene.start('gameOverScene', { level: this.level }) })
    }
}