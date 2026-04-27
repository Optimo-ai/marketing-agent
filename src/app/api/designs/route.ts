import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { posts } = body

    if (!posts || posts.length === 0) {
      return NextResponse.json({ error: 'No hay posts para generar imágenes' }, { status: 400 })
    }

    // Simulamos el tiempo que tardaría un modelo como DALL-E en generar imágenes
    await new Promise(resolve => setTimeout(resolve, 2500))

    // Generar mocks de imágenes reales de propiedades para los primeros 4 posts 
    const designs = posts.slice(0, 4).map((post: any, i: number) => {
      const images = [
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80', // Exterior casa
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80', // Moderna
        'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=600&q=80', // Sala de estar
        'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=600&q=80'  // Piscina
      ];
      return {
        postId: post.id || i,
        postName: post.name,
        imageUrl: images[i % images.length]
      }
    })

    return NextResponse.json({ designs })
  } catch (err: unknown) {
    console.error('Designs POST error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}