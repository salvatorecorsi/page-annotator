<?php
/**
 * Plugin Name:       Page Annotator
 * Plugin URI:        https://github.com/salvatorecorsi/page-annotator
 * Description:       Draw SVG annotations over any page/post, saved as custom fields and rendered as a non-interactive overlay on the frontend with scroll-triggered stroke animations.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Salvatore Corsi
 * Author URI:        https://salvatorecorsi.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       page-annotator
 *
 * @package PageAnnotator
 * @author  Salvatore Corsi
 * @link    https://salvatorecorsi.com
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'PA_VERSION', '1.3.1' );
define( 'PA_PATH', plugin_dir_path( __FILE__ ) );
define( 'PA_URL', plugin_dir_url( __FILE__ ) );

require_once PA_PATH . 'includes/rest-api.php';
require_once PA_PATH . 'includes/admin.php';
require_once PA_PATH . 'includes/frontend.php';
require_once PA_PATH . 'includes/settings.php';
require_once PA_PATH . 'includes/thumbnail.php';

add_action( 'init', function () {
	$post_types = get_post_types( array( 'public' => true ) );

	foreach ( $post_types as $post_type ) {
		register_post_meta( $post_type, '_page_annotator_svg', array(
			'show_in_rest'  => false,
			'single'        => true,
			'type'          => 'string',
			'auth_callback' => function () {
				return current_user_can( 'edit_posts' );
			},
		) );

		register_post_meta( $post_type, '_page_annotator_timeline', array(
			'show_in_rest'  => false,
			'single'        => true,
			'type'          => 'string',
			'auth_callback' => function () {
				return current_user_can( 'edit_posts' );
			},
		) );
	}
} );
