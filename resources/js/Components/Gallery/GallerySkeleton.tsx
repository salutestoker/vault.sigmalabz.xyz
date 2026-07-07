export default function GallerySkeleton() {
    return (
        <div className="vault-gallery__grid" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, index) => (
                <div
                    key={index}
                    className="vault-gallery__skeleton"
                    style={{
                        aspectRatio:
                            index % 4 === 0
                                ? '4 / 5'
                                : index % 3 === 0
                                  ? '1 / 1'
                                  : '5 / 4',
                    }}
                />
            ))}
        </div>
    );
}
