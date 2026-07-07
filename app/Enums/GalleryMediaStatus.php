<?php

namespace App\Enums;

enum GalleryMediaStatus: string
{
    case Pending = 'pending';
    case Imported = 'imported';
    case Processing = 'processing';
    case Ready = 'ready';
    case Failed = 'failed';
}
